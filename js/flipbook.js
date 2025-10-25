import { dom } from './dom.js';
import { showError, showFlipbook } from './ui.js';

const PageFlip = window.St.PageFlip;
let pageFlipInstance = null;
const MAX_CONTENT_HEIGHT = 480; // Heuristic value: 550px page height - 2*2rem padding - buffer

export function paginateHtmlContent(fullHtml) {
    // 1. Create a container for all nodes from the parsed HTML
    const sourceContainer = document.createElement('div');
    sourceContainer.innerHTML = fullHtml;
    const nodes = Array.from(sourceContainer.childNodes);

    // 2. Create an off-screen measurer div, styled like a real page
    const measurer = document.createElement('div');
    Object.assign(measurer.style, {
        position: 'absolute', left: '-9999px', visibility: 'hidden',
        width: '336px', height: 'auto', // 400px book width - 2*2rem padding
    });
    measurer.className = 'page-content prose';
    document.body.appendChild(measurer);

    const pages = [];
    if (nodes.length === 0) {
        document.body.removeChild(measurer);
        return [];
    }

    // 3. Loop through nodes, adding them to the measurer until it overflows
    for (const node of nodes) {
        const clonedNode = node.cloneNode(true);
        measurer.appendChild(clonedNode);

        if (measurer.scrollHeight > MAX_CONTENT_HEIGHT) {
            // It overflowed. Remove the node that caused it.
            measurer.removeChild(clonedNode);

            // If the measurer has content, that's a complete page.
            if (measurer.innerHTML.trim() !== '') {
                pages.push(measurer.innerHTML);
            }

            // Start a new page with the node that caused the overflow.
            measurer.innerHTML = '';
            measurer.appendChild(clonedNode);
            
            // Handle the rare case where a single element is too tall for a page.
            if (measurer.scrollHeight > MAX_CONTENT_HEIGHT) {
                pages.push(measurer.innerHTML);
                measurer.innerHTML = '';
            }
        }
    }

    // 4. Add the last page if it has any remaining content
    if (measurer.innerHTML.trim() !== '') {
        pages.push(measurer.innerHTML);
    }

    // 5. Cleanup the measurer from the DOM
    document.body.removeChild(measurer);
    return pages;
}

function updateControls(currentPage, totalPages) {
    const displayPage = totalPages > 0 ? currentPage + 1 : 0;
    dom.pageCounter.textContent = `Page ${displayPage} of ${totalPages}`;
    dom.prevPageBtn.disabled = currentPage === 0;
    dom.nextPageBtn.disabled = currentPage >= totalPages - 1;
}

export function createFlipbook(pages) {
    if (pageFlipInstance) {
        pageFlipInstance.destroy();
        pageFlipInstance = null;
    }

    dom.flipbookEl.innerHTML = ''; // Clear previous content

    if (pages.length === 0) {
        showError("Could not generate any pages from the provided content.");
        return;
    }

    // Check if the book content is image-based (from PDF) or text-based
    const isImageBook = pages.length > 0 && pages[0].startsWith('data:image/');

    pages.forEach((content, index) => {
        const pageElement = document.createElement('div');
        pageElement.classList.add('page');
        
        // Make the first and last pages 'hard' covers
        if (index === 0 || index === pages.length - 1) {
            pageElement.dataset.density = 'hard';
        }

        if (isImageBook) {
            pageElement.innerHTML = `<img src="${content}" alt="Page ${index + 1}" class="page-image" />`;
        } else {
             pageElement.innerHTML = `
                <div class="page-content">
                    <div class="prose">${content}</div>
                    <div class="page-footer">${index + 1}</div>
                </div>
            `;
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
    });
    
    // Initial control state
    updateControls(pageFlipInstance.getCurrentPageIndex(), pageFlipInstance.getPageCount());

    showFlipbook();
    
    // Set focus to the "Create New" button for accessibility
    dom.createNewBtn.focus();
}

export function flipPrevPage() {
    pageFlipInstance?.flipPrev();
}

export function flipNextPage() {
    pageFlipInstance?.flipNext();
}