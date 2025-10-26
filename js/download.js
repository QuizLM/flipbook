import { state } from './state.js';
import { blobToBase64 } from './utils.js';

/**
 * Creates the HTML for the cover page, designed to fit the styles in the downloadable template.
 * @param {object} options - Flipbook options containing cover details.
 * @returns {string} - HTML string for the cover page.
 */
function createCoverPageHtmlForDownload(options) {
    const { title, author, image } = options.cover;
    if (!title && !author && !image) return '';

    const imageHtml = image 
        ? `<img src="${image}" alt="Cover Image" style="max-width: 70%; max-height: 50%; object-fit: contain; margin-bottom: 1.5rem; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">` 
        : '';
    const titleHtml = title ? `<h1>${title}</h1>` : '';
    const authorHtml = author ? `<h2>${author}</h2>` : '';
    
    // This structure matches the .cover-page style in the new flipbook.html template
    return `<div class="cover-page">${imageHtml}${titleHtml}${authorHtml}</div>`;
}

/**
 * Fetches a resource from a URL and returns its text content.
 * @param {string} url - The URL of the resource to fetch.
 * @returns {Promise<string>} - A promise that resolves to the text content.
 */
async function fetchResourceAsText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch resource: ${url}`);
    return response.text();
}

/**
 * Generates and triggers the download of a self-contained HTML flipbook.
 */
export async function downloadFlipbookAsHtml() {
    const { pages, options, isImageBook } = state.flipbookContent;
    
    if (!pages || pages.length === 0) {
        throw new Error("No flipbook content available to download.");
    }
    
    // Fetch the HTML template. The new template is self-contained with CSS and JS.
    const template = await fetchResourceAsText('./flipbook.html');

    // 1. PREPARE PAGE CONTENTS ARRAY
    const finalPageContents = [];

    // Create and add cover page if it exists
    const coverHtml = createCoverPageHtmlForDownload(options);
    if (coverHtml) {
        finalPageContents.push(coverHtml);
    }

    // Process main pages (text or images)
    if (isImageBook) {
        const base64Promises = pages.map(blobUrl => 
            fetch(blobUrl).then(res => res.blob()).then(blobToBase64)
        );
        const base64Pages = await Promise.all(base64Promises);
        // Wrap images in simple HTML for display
        const imagePageHtml = base64Pages.map(src => `<img src="${src}" style="width:100%; height:100%; object-fit:contain;" alt="Page image">`);
        finalPageContents.push(...imagePageHtml);
    } else {
        // For text books, the pages are already HTML strings
        finalPageContents.push(...pages);
    }
    
    // Add a blank back cover if there was a front cover
    if (coverHtml) {
        finalPageContents.push(`<div class="cover-page"></div>`);
    }

    // Convert the array of HTML strings into a single, JS-safe string for injection.
    // e.g., ["<p>Hi</p>", "Page 2"] becomes '\"<p>Hi</p>\", \"Page 2\"'
    const pageContentsArrayString = finalPageContents.map(html => JSON.stringify(html)).join(',\n');
    
    // 2. PREPARE FLIPBOOK CONFIGURATION
    const flipbookConfig = {
        width: 400, height: 550, size: 'stretch',
        minWidth: 315, maxWidth: 1000, minHeight: 420,
        maxHeight: 1350, maxShadowOpacity: 0.5,
        showCover: !!coverHtml, mobileScrollSupport: false,
        usePortrait: true, // A good default for a portable file
    };
    const configJsonString = JSON.stringify(flipbookConfig, null, 2);

    // 3. INJECT DYNAMIC CONTENT INTO THE TEMPLATE
    // We use regex to replace the hardcoded data in the template's script.
    const finalHtml = template
        // Replace the title in the <head>
        .replace(/<title>.*?<\/title>/, `<title>${options.cover.title || 'My Flipbook'}</title>`)
        // Replace the hardcoded chaptersData array
        .replace(/const chaptersData = \[[\s\S]*?\];/, `const chaptersData = [${pageContentsArrayString}];`)
        // Replace the hardcoded PageFlip configuration object
        .replace(/pageFlip = new St\.PageFlip\(bookElement, {[\s\S]*?}\);/, `pageFlip = new St.PageFlip(bookElement, ${configJsonString});`);

    // 4. TRIGGER THE DOWNLOAD
    const blob = new Blob([finalHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (options.cover.title || 'flipbook').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `${safeTitle}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}