import { state } from './state.js';
import { blobToBase64 } from './utils.js';

// The entire flipbook.html content is now inlined here to avoid network errors.
const FLIPBOOK_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Flipbook</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;700&family=Lora:wght@400;700&display=swap" rel="stylesheet">
    <!-- StPageFlip Library from CDN -->
    <script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js"><\/script>
    <style>
        :root {
            --primary-font: 'Noto Serif Devanagari', serif;
            --secondary-font: 'Lora', serif;
            --bg-color: #f0f0f0;
            --page-bg: #fdfaf6;
            --text-color: #333;
            --header-color: #5d4037;
            --nav-bg: #ffffff;
            --button-bg: #8d6e63;
            --button-text: #ffffff;
            --button-disabled-bg: #d7ccc8;
        }
        html, body {
            margin: 0; padding: 0; font-family: var(--primary-font);
            background-color: var(--bg-color); height: 100vh; width: 100vw; overflow: hidden;
        }
        .book-stage {
            display: flex; justify-content: center; align-items: center;
            height: calc(100vh - 60px); width: 100%; padding: 20px; box-sizing: border-box;
        }
        .flip-book {
            box-shadow: 0 0 20px 0 rgba(0,0,0,0.5); display: none;
        }
        .page {
            background-color: var(--page-bg); padding: 30px 40px; border: 1px solid #e0e0e0;
            overflow: hidden; box-sizing: border-box;
        }
        .page-content { height: 100%; overflow-y: auto; padding-right: 10px; }
        .page-content::-webkit-scrollbar { width: 6px; }
        .page-content::-webkit-scrollbar-thumb { background-color: #bcaaa4; border-radius: 3px; }
        .cover-page {
            display: flex; flex-direction: column; justify-content: center;
            align-items: center; height: 100%; text-align: center;
            border: 2px solid var(--header-color); padding: 20px;
        }
        .cover-page img { max-width: 80%; max-height: 50%; object-fit: contain; margin-bottom: 1.5rem; }
        .cover-page h1 { font-size: 2.2em; color: var(--header-color); }
        .cover-page h2 { font-size: 1.4em; color: var(--text-color); font-weight: normal; }
        .page-footer { position: absolute; bottom: 15px; width: 100%; text-align: center; font-size: 0.8em; color: #777; left: 0; }
        footer {
            position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background-color: var(--nav-bg);
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1); display: flex; justify-content: space-between;
            align-items: center; padding: 0 20px; box-sizing: border-box; z-index: 1000;
        }
        footer button {
            background-color: var(--button-bg); color: var(--button-text); border: none; padding: 10px 20px;
            border-radius: 5px; font-size: 1em; font-family: var(--secondary-font); cursor: pointer; transition: background-color 0.2s;
        }
        footer button:hover:not(:disabled) { background-color: #6d4c41; }
        footer button:disabled { background-color: var(--button-disabled-bg); cursor: not-allowed; opacity: 0.7; }
        #page-indicator { font-size: 1em; font-weight: bold; color: var(--text-color); }
    </style>
</head>
<body>
    <div class="book-stage">
        <div id="book" class="flip-book"></div>
    </div>
    <footer>
        <button id="prev-btn">Previous</button>
        <span id="page-indicator">Loading...</span>
        <button id="next-btn">Next</button>
    </footer>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const bookElement = document.getElementById('book');
            const prevBtn = document.getElementById('prev-btn');
            const nextBtn = document.getElementById('next-btn');
            const pageIndicator = document.getElementById('page-indicator');
            let pageFlip;
            
            //__PLACEHOLDER_PAGES_AND_CONFIG__

            chaptersData.forEach((content, index) => {
                const pageDiv = document.createElement('div');
                pageDiv.className = 'page';
                const isCover = pageFlip.getSettings().showCover && (index === 0 || index === chaptersData.length - 1);
                
                if (isCover) {
                    pageDiv.innerHTML = content;
                } else if (content.startsWith('<img')) {
                     pageDiv.innerHTML = content;
                } else {
                     pageDiv.innerHTML = \`<div class="page-content">\${content}<div class="page-footer">\${index}</div></div>\`;
                }

                if (isCover) {
                    pageDiv.dataset.density = 'hard';
                }

                bookElement.appendChild(pageDiv);
            });

            pageFlip.loadFromHTML(document.querySelectorAll('.page'));

            pageFlip.on('flip', (e) => { updateUI(e.data); });

            function updateUI(currentPageIndex) {
                const totalPages = pageFlip.getPageCount();
                let currentDisp = currentPageIndex + 1;
                if (pageFlip.getOrientation() === 'landscape' && currentPageIndex > 0 && currentPageIndex < totalPages - 1) {
                    currentDisp = \`\${currentPageIndex}-\${currentPageIndex + 1}\`;
                }
                pageIndicator.textContent = \`Page \${currentDisp} of \${totalPages}\`;
                prevBtn.disabled = currentPageIndex === 0;
                nextBtn.disabled = currentPageIndex >= totalPages - 1;
            }
            
            prevBtn.addEventListener('click', () => { pageFlip.flipPrev(); });
            nextBtn.addEventListener('click', () => { pageFlip.flipNext(); });

            setTimeout(() => {
                 updateUI(pageFlip.getCurrentPageIndex());
                 bookElement.style.display = 'block';
            }, 100);
        });
    <\/script>
</body>
</html>
`;

/**
 * Creates the HTML for the cover page, designed to fit the styles in the downloadable template.
 * @param {object} options - Flipbook options containing cover details.
 * @returns {string} - HTML string for the cover page.
 */
function createCoverPageHtmlForDownload(options) {
    const { title, author, image } = options.cover;
    if (!title && !author && !image) return '';

    const imageHtml = image 
        ? `<img src="${image}" alt="Cover Image">` 
        : '';
    const titleHtml = title ? `<h1>${title}</h1>` : '';
    const authorHtml = author ? `<h2>${author}</h2>` : '';
    
    return `<div class="cover-page">${imageHtml}${titleHtml}${authorHtml}</div>`;
}

/**
 * Generates and triggers the download of a self-contained HTML flipbook.
 */
export async function downloadFlipbookAsHtml() {
    const { pages, options, isImageBook } = state.flipbookContent;
    
    if (!pages || pages.length === 0) {
        throw new Error("No flipbook content available to download.");
    }
    
    // 1. PREPARE PAGE CONTENTS ARRAY
    const finalPageContents = [];
    const coverHtml = createCoverPageHtmlForDownload(options);
    if (coverHtml) {
        finalPageContents.push(coverHtml);
    }

    if (isImageBook) {
        const base64Promises = pages.map(blobUrl => 
            fetch(blobUrl).then(res => res.blob()).then(blobToBase64)
        );
        const base64Pages = await Promise.all(base64Promises);
        const imagePageHtml = base64Pages.map(src => `<img src="${src}" style="width:100%; height:100%; object-fit:contain;" alt="Page image">`);
        finalPageContents.push(...imagePageHtml);
    } else {
        finalPageContents.push(...pages);
    }
    
    if (coverHtml) {
        finalPageContents.push(`<div class="cover-page"></div>`);
    }

    const pageContentsArrayString = `const chaptersData = [${finalPageContents.map(html => JSON.stringify(html)).join(',\n')}];`;
    
    // 2. PREPARE FLIPBOOK CONFIGURATION
    const baseConfig = {
        width: 400, height: 550, size: 'stretch',
        minWidth: 315, maxWidth: 1000, minHeight: 420,
        maxHeight: 1350, maxShadowOpacity: 0.5,
        showCover: !!coverHtml, 
        mobileScrollSupport: true,
    };

    const dynamicConfigScript = `
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
        
        const config = ${JSON.stringify(baseConfig, null, 2)};
        config.clickToFlip = !isMobile; // Enable click-to-flip ONLY on non-mobile devices

        pageFlip = new St.PageFlip(bookElement, config);
    `;

    // 3. INJECT DYNAMIC CONTENT INTO THE TEMPLATE
    const finalHtml = FLIPBOOK_TEMPLATE_HTML
        .replace(/<title>.*?<\/title>/, `<title>${options.cover.title || 'My Flipbook'}</title>`)
        .replace('//__PLACEHOLDER_PAGES_AND_CONFIG__', `${pageContentsArrayString}\n${dynamicConfigScript}`);

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