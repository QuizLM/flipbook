import { dom } from './js/dom.js';
import { showLoader, showError, showFlipbook, updateLoaderProgress, resetView, switchTab } from './js/ui.js';
import { processFile } from './js/content.js';
import { createFlipbook, flipPrevPage, flipNextPage, paginateHtmlContent } from './js/flipbook.js';

// --- Main App Logic ---

async function generateFlipbook(fileOrText) {
    showLoader();
    dom.fileNameDisplay.textContent = '';
    
    try {
        let content;
        // Check if we are processing a file or raw text
        if (typeof fileOrText === 'string') {
            // Simulate progress for faster text processing
            updateLoaderProgress(30);
            await new Promise(resolve => setTimeout(resolve, 50));
            updateLoaderProgress(60);
            content = await Promise.resolve(fileOrText);
            updateLoaderProgress(90);

        } else { // It's a file
            const onProgress = (percentage) => {
                updateLoaderProgress(percentage);
            };
            content = await processFile(fileOrText, onProgress);
        }
        
        updateLoaderProgress(95); // Content processing is done

        let pages;
        if (Array.isArray(content)) {
            // Content is an array of image data URLs from a PDF
            pages = content;
        } else if (typeof content === 'string') {
            // Content is text or markdown string
            const fullHtml = marked.parse(content, { breaks: true });
            pages = paginateHtmlContent(fullHtml);
        } else {
            throw new Error('Unsupported content type for flipbook generation.');
        }
        
        // Using setTimeout to give the UI a moment to update before the potentially blocking flipbook creation
        setTimeout(() => {
            createFlipbook(pages);
            updateLoaderProgress(100);
        }, 100);

    } catch (error) {
        showError(error.message || 'An unknown error occurred.');
    }
}

// --- UI Effects ---

function addSparkleEffect(button) {
    button.addEventListener('mousemove', (e) => {
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        button.style.setProperty('--x', `${x}px`);
        button.style.setProperty('--y', `${y}px`);
    });
}

// --- Keyboard Navigation ---

function handleTabKeydown(e) {
    const tabs = [dom.fileTabBtn, dom.textTabBtn];
    const activeIndex = tabs.findIndex(tab => tab === document.activeElement);

    if (activeIndex === -1) return;

    let newIndex = -1;
    if (e.key === 'ArrowRight') {
        newIndex = (activeIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
        newIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    }

    if (newIndex !== -1) {
        e.preventDefault();
        const newTab = tabs[newIndex];
        switchTab(newTab.dataset.mode);
        newTab.focus();
    }
}

// --- Event Listeners Setup ---

function initEventListeners() {
    // Tab switching
    dom.fileTabBtn.addEventListener('click', () => switchTab('file'));
    dom.textTabBtn.addEventListener('click', () => switchTab('text'));
    dom.tabsContainer.addEventListener('keydown', handleTabKeydown);

    // File input
    dom.dropzoneInput.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        dom.fileNameDisplay.textContent = `Selected: ${file.name}`;
        generateFlipbook(file);
        event.target.value = ''; // Reset for same-file upload
    });
    
    // Drag and Drop
    dom.dropzoneLabel.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.dropzoneLabel.classList.add('dragging');
    });
     dom.dropzoneLabel.addEventListener('dragleave', (e) => {
        dom.dropzoneLabel.classList.remove('dragging');
    });
    dom.dropzoneLabel.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropzoneLabel.classList.remove('dragging');
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        dom.fileNameDisplay.textContent = `Selected: ${file.name}`;
        generateFlipbook(file);
    });

    // Text input
     dom.textInput.addEventListener('input', () => {
        dom.createFromTextBtn.disabled = !dom.textInput.value.trim();
    });
    dom.createFromTextBtn.addEventListener('click', () => {
        const text = dom.textInput.value;
        if (!text.trim()) {
            showError("Text content cannot be empty.");
            return;
        }
        generateFlipbook(text);
    });

    // Flipbook controls
    dom.prevPageBtn.addEventListener('click', flipPrevPage);
    dom.nextPageBtn.addEventListener('click', flipNextPage);
    dom.createNewBtn.addEventListener('click', resetView);

    // Initialize UI Effects
    addSparkleEffect(dom.createFromTextBtn);
    addSparkleEffect(dom.createNewBtn);
}

// --- App Initialization ---

document.addEventListener('DOMContentLoaded', initEventListeners);