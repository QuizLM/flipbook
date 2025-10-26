
const readTextFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsText(file);
    });
};

// --- PDF Worker Logic ---
// By embedding the worker code in a string, we avoid needing a separate worker file.
const pdfWorkerCode = `
    // Import the PDF.js library within the worker's scope
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    // Set the source for the PDF.js worker, which is also required.
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // Listen for messages from the main thread
    self.onmessage = async (event) => {
        const { file } = event.data;
        try {
            const typedarray = new Uint8Array(await file.arrayBuffer());
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            const pageImageUrls = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                // Use a reasonable scale to balance quality and performance
                const viewport = page.getViewport({ scale: 1.8 });
                // OffscreenCanvas is ideal for workers as it doesn't touch the DOM
                const canvas = new OffscreenCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');

                await page.render({ canvasContext: context, viewport: viewport }).promise;
                // Convert to a Blob for efficient transfer back to the main thread
                const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
                pageImageUrls.push(blob);
                
                // Post progress updates back to the main thread
                self.postMessage({ type: 'progress', percentage: (i / pdf.numPages) * 90 });
            }
            
            // Post the final result
            self.postMessage({ type: 'result', pages: pageImageUrls });
        } catch (error) {
            console.error('PDF processing error in worker:', error);
            self.postMessage({ type: 'error', message: 'Could not parse PDF. It may be corrupted.' });
        }
    };
`;

const readPdfFileWithWorker = (file, onProgress) => {
    return new Promise((resolve, reject) => {
        // Create the worker from the string code using a Blob
        const blob = new Blob([pdfWorkerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        const pageImageBlobs = [];

        worker.onmessage = (e) => {
            const { type, percentage, pages, message } = e.data;
            if (type === 'progress') {
                onProgress(percentage);
            } else if (type === 'result') {
                // Convert received Blobs to Object URLs on the main thread
                const pageImageUrls = pages.map(blob => URL.createObjectURL(blob));
                resolve(pageImageUrls);
                worker.terminate();
            } else if (type === 'error') {
                reject(new Error(message));
                worker.terminate();
            }
        };

        worker.onerror = (e) => {
            reject(new Error(`Worker error: ${e.message}`));
            worker.terminate();
        };
        
        // Start the worker by sending the file
        worker.postMessage({ file });
    });
};

export async function processFile(file, onProgress) {
    if (file.type === 'application/pdf') return readPdfFileWithWorker(file, onProgress);
    if (file.type === 'text/plain' || file.type === 'text/markdown') return readTextFile(file);
    throw new Error('Unsupported file type. Please upload a PDF, TXT, or MD file.');
};
