

const readTextFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsText(file);
    });
};

// Main-thread PDF processing function
const readPdfFileOnMainThread = async (file, onProgress) => {
    try {
        // Ensure pdfjsLib and its worker are configured. This is a safeguard;
        // it should already be configured in index.html.
        if (typeof pdfjsLib === 'undefined' || !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            console.warn('PDF.js worker not pre-configured. Setting it now.');
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        }
        
        const typedarray = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const pageImageUrls = [];
        
        // Create a single, reusable canvas element (off-screen) to render pages
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            // Use a reasonable scale to balance quality and performance
            const viewport = page.getViewport({ scale: 1.8 });
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            // Convert canvas to a blob, which is more memory-efficient than a data URL
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
            
            // Create an object URL from the blob for the flipbook to use
            pageImageUrls.push(URL.createObjectURL(blob));
            
            // Update the progress bar for a better user experience
            onProgress((i / pdf.numPages) * 90);
        }
        
        // Clean up the canvas element
        canvas.remove();
        
        return pageImageUrls;

    } catch (error) {
        console.error('PDF processing error:', error);
        // Throw a more informative error message
        throw new Error(error.message || 'Could not parse PDF. It may be corrupted.');
    }
};

export async function processFile(file, onProgress) {
    if (file.type === 'application/pdf') {
        // We're moving PDF processing to the main thread to fix a potential
        // issue with nested workers. This might cause the UI to be less responsive
        // for very large PDFs, but ensures reliability.
        return readPdfFileOnMainThread(file, onProgress);
    }
    if (file.type === 'text/plain' || file.type === 'text/markdown') {
        return readTextFile(file);
    }
    throw new Error('Unsupported file type. Please upload a PDF, TXT, or MD file.');
}