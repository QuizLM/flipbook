export const readTextFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsText(file);
    });
};

export const readPdfFile = (file, onProgress) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (!event.target?.result) return reject(new Error('Failed to load PDF file.'));
            try {
                const typedarray = new Uint8Array(event.target.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                const pageImageUrls = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport,
                    };

                    await page.render(renderContext).promise;
                    pageImageUrls.push(canvas.toDataURL('image/jpeg', 0.92));
                    
                    // Report progress, scaling to 90% as rendering is the main task
                    if (onProgress) {
                        onProgress((i / pdf.numPages) * 90);
                    }
                }
                
                resolve(pageImageUrls);

            } catch (error) {
                console.error('PDF processing error:', error);
                reject(new Error('Could not parse PDF. It may be corrupted.'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read PDF file.'));
        reader.readAsArrayBuffer(file);
    });
};

export async function processFile(file, onProgress) {
    if (file.type === 'application/pdf') return readPdfFile(file, onProgress);
    if (file.type === 'text/plain' || file.type === 'text/markdown') return readTextFile(file);
    throw new Error('Unsupported file type. Please upload a PDF, TXT, or MD file.');
};