

import { dom } from './dom.js';
import { showError, showFlipbook } from './ui.js';
import { generateAndPlayAudio, stopAllAudio } from './tts.js';

const PageFlip = window.St.PageFlip;
let pageFlipInstance = null;
// The page flip instance has a height of 550px.
// The .page-content CSS has top padding of 2.5rem (40px) and bottom padding of 3.5rem (56px).
// Total vertical padding = 96px.
// Available content height = 550 - 96 = 454px.
// We use a slightly smaller value to account for browser rendering differences and margins.
const MAX_CONTENT_HEIGHT = 450;
let searchablePageCache = [];

export function getFlipbookInstance() {
    return pageFlipInstance;
}

export function getSearchablePages(pages, isImageBook) {
    if (isImageBook) {
        searchablePageCache = pages.map(() => ''); // No text to search in images
        return searchablePageCache;
    }
    const tempDiv = document.createElement('div');
    searchablePageCache = pages.map(html => {
        tempDiv.innerHTML = html;
        return tempDiv.textContent || '';
    });
    return searchablePageCache;
}

export function paginateHtmlContent(fullHtml, theme = 'default') {
    const sourceContainer = document.createElement('div');
    sourceContainer.innerHTML = fullHtml;
    const nodes = Array.from(sourceContainer.childNodes);

    // Create a temporary wrapper with the correct theme class for accurate measurement
    const wrapper = document.createElement('div');
    // We add the theme class directly to the wrapper to simulate the final render environment
    wrapper.className = `theme-${theme}`;
    Object.assign(wrapper.style, {
        position: 'absolute',
        left: '-9999px',
        visibility: 'hidden',
    });

    const measurer = document.createElement('div');
    Object.assign(measurer.style, {
        // FIX: Correctly calculate the width based on the flipbook size and padding.
        // Flipbook width is 400px, padding is 1.5rem (24px) left and right.
        // Content width = 400 - (2 * 24) = 352px.
        width: '352px',
        height: 'auto',
    });
    measurer.className = 'page-content prose';
    
    wrapper.appendChild(measurer);
    document.body.appendChild(wrapper);

    const pages = [];
    if (nodes.length === 0) {
        document.body.removeChild(wrapper); // Clean up
        return [];
    }

    for (const node of nodes) {
        const clonedNode = node.cloneNode(true);
        measurer.appendChild(clonedNode);

        if (measurer.scrollHeight > MAX_CONTENT_HEIGHT) {
            measurer.removeChild(clonedNode);
            if (measurer.innerHTML.trim() !== '') {
                pages.push(measurer.innerHTML);
            }
            measurer.innerHTML = '';
            measurer.appendChild(clonedNode);
            // Re-check in case a single element is too large for a page
            if (measurer.scrollHeight > MAX_CONTENT_HEIGHT) {
                pages.push(measurer.innerHTML); // Add it anyway to not lose content
                measurer.innerHTML = '';
            }
        }
    }

    if (measurer.innerHTML.trim() !== '') {
        pages.push(measurer.innerHTML);
    }

    document.body.removeChild(wrapper); // Clean up the wrapper and measurer
    return pages;
}

function updateControls(currentPage, totalPages) {
    const displayPage = totalPages > 0 ? currentPage + 1 : 0;
    dom.pageCounter.textContent = `Page ${displayPage} of ${totalPages}`;
    dom.prevPageBtn.disabled = currentPage === 0;
    dom.nextPageBtn.disabled = currentPage >= totalPages - 1;
}

function createCoverPage(options) {
    const hasContent = options.cover.title || options.cover.author || options.cover.image;
    if (!hasContent) return null;

    const imageHtml = options.cover.image ? `<img src="${options.cover.image}" alt="Cover Image" class="cover-image">` : '';
    const titleHtml = options.cover.title ? `<h1 class="cover-title">${options.cover.title}</h1>` : '';
    const authorHtml = options.cover.author ? `<p class="cover-author">${options.cover.author}</p>` : '';

    return `<div class="cover-page">${imageHtml}${titleHtml}${authorHtml}</div>`;
}

export function createFlipbook(pages, options) {
    if (pageFlipInstance) {
        pageFlipInstance.destroy();
        pageFlipInstance = null;
    }
    stopAllAudio();

    dom.flipbookEl.innerHTML = '';
    dom.flipbookWrapper.className = 'hidden'; // Reset classes
    dom.flipbookWrapper.classList.add(`theme-${options.theme}`);


    if (pages.length === 0) {
        showError("Could not generate any pages from the provided content.");
        return;
    }

    const isImageBook = pages.length > 0 && pages[0].startsWith('data:image/');
    
    // Add cover if designed
    const finalPages = [...pages];
    const coverHtml = createCoverPage(options);
    if (coverHtml) {
        finalPages.unshift(coverHtml);
        finalPages.push(''); // Blank back cover
    }

    finalPages.forEach((content, index) => {
        const pageElement = document.createElement('div');
        pageElement.classList.add('page');
        
        if (index === 0 || index === finalPages.length - 1) {
            pageElement.dataset.density = 'hard';
        }

        const isCover = coverHtml && (index === 0 || index === finalPages.length - 1);

        if (isCover) {
            pageElement.innerHTML = content;
        } else if (isImageBook) {
            pageElement.innerHTML = `<img src="${content}" alt="Page ${index + 1}" class="page-image" />`;
        } else {
             pageElement.innerHTML = `
                <div class="page-content">
                    <div class="prose">${content}</div>
                    <div class="page-footer">${index + 1}</div>
                </div>
            `;
            // Add narration button if enabled
            if (options.narration) {
                const narrationButton = dom.narrationButtonTemplate.content.cloneNode(true).firstElementChild;
                pageElement.querySelector('.page-content').appendChild(narrationButton);
                
                narrationButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const pageText = searchablePageCache[coverHtml ? index - 1 : index]; // Adjust index for cover
                    if (pageText) {
                        await generateAndPlayAudio(pageText, narrationButton);
                    }
                });
            }
        }
        dom.flipbookEl.appendChild(pageElement);
    });

    pageFlipInstance = new PageFlip(dom.flipbookEl, {
        width: 400, height: 550, size: 'stretch',
        minWidth: 315, maxWidth: 1000, minHeight: 420,
        maxHeight: 1350, maxShadowOpacity: 0.5,
        showCover: true, mobileScrollSupport: true,
    });

    pageFlipInstance.loadFromHTML(document.querySelectorAll('.page'));

    pageFlipInstance.on('flip', (e) => {
        updateControls(e.data, pageFlipInstance.getPageCount());
        stopAllAudio(); // Stop audio when flipping pages
    });
    
    updateControls(pageFlipInstance.getCurrentPageIndex(), pageFlipInstance.getPageCount());
    showFlipbook();
    dom.createNewBtn.focus();
}

export function flipPrevPage() {
    pageFlipInstance?.flipPrev();
}

export function flipNextPage() {
    pageFlipInstance?.flipNext();
}

export function flipToPage(pageIndex) {
    pageFlipInstance?.flip(pageIndex);
}