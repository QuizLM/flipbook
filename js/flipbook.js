
import { dom } from './dom.js';
import { showError, showFlipbook } from './ui.js';
import { generateAndPlayAudio, stopAllAudio } from './tts.js';

const PageFlip = window.St.PageFlip;
let pageFlipInstance = null;
let searchablePageCache = [];

function getDynamicContentHeight() {
    // Create a temporary page element to measure the available content height based on CSS.
    // This makes the pagination robust against future CSS changes to padding or line-height.
    const tempPage = document.createElement('div');
    Object.assign(tempPage.style, {
        position: 'absolute',
        top: '-9999px',
        left: '-9999px',
        visibility: 'hidden',
        width: '400px', // Match the PageFlip config width for accurate measurement
        height: '550px', // Match the PageFlip config height
    });
    tempPage.className = 'page';

    const tempContent = document.createElement('div');
    tempContent.className = 'page-content';
    tempPage.appendChild(tempContent);
    document.body.appendChild(tempPage);
    
    // clientHeight is the inner height of an element, including padding.
    // This gives us the precise available vertical space for content.
    const height = tempContent.clientHeight;

    document.body.removeChild(tempPage); // Clean up the temporary element
    
    // Return the calculated height with a small buffer for safety against minor rendering quirks.
    return height - 5;
}


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
    const MAX_CONTENT_HEIGHT = getDynamicContentHeight();
    const sourceContainer = document.createElement('div');
    sourceContainer.innerHTML = fullHtml;
    const nodes = Array.from(sourceContainer.childNodes);

    const wrapper = document.createElement('div');
    wrapper.className = `theme-${theme}`;
    Object.assign(wrapper.style, {
        position: 'absolute',
        left: '-9999px',
        visibility: 'hidden',
    });

    const measurer = document.createElement('div');
    Object.assign(measurer.style, {
        width: '352px', /* Content width: 400px (book) - 2 * 24px (padding) */
        height: 'auto',
    });
    measurer.className = 'page-content prose';
    
    wrapper.appendChild(measurer);
    document.body.appendChild(wrapper);

    const pages = [];
    if (nodes.length === 0) {
        document.body.removeChild(wrapper);
        return [];
    }

    for (const node of nodes) {
        const clonedNode = node.cloneNode(true);
        measurer.appendChild(clonedNode);

        // Check if adding the new node exceeds the max height
        if (measurer.scrollHeight > MAX_CONTENT_HEIGHT) {
            measurer.removeChild(clonedNode);

            // If there was content in the measurer before this node, push it as a completed page
            if (measurer.innerHTML.trim() !== '') {
                pages.push(measurer.innerHTML);
            }
            measurer.innerHTML = '';

            // Now, process the node that caused the overflow
            measurer.appendChild(clonedNode);
            
            // If this single node is *still* too big, wrap it in a scrollable container and put it on its own page
            if (measurer.scrollHeight > MAX_CONTENT_HEIGHT) {
                const oversizedWrapper = document.createElement('div');
                oversizedWrapper.className = 'oversized-content';
                oversizedWrapper.appendChild(clonedNode.cloneNode(true));
                pages.push(oversizedWrapper.outerHTML);
                measurer.innerHTML = '';
            }
        }
    }

    // Add any remaining content in the measurer as the last page
    if (measurer.innerHTML.trim() !== '') {
        pages.push(measurer.innerHTML);
    }

    document.body.removeChild(wrapper); // Clean up the measurement elements
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

    const isImageBook = pages.length > 0 && pages[0].startsWith('blob:'); // PDFs are now blob URLs
    
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
