
import { dom } from './js/dom.js';
import { state } from './js/state.js';
import { 
    showLoader, 
    showError, 
    updateLoaderProgress, 
    resetView, 
    switchTab,
    addSparkleEffect,
    updateGenerateButtonState,
    handleTabKeydown,
    toggleFullScreen,
    handleFullScreenChange
} from './js/ui.js';
import { processFile } from './js/content.js';
import { createFlipbook, flipPrevPage, flipNextPage, paginateHtmlContent, getSearchablePages } from './js/flipbook.js';
import { initTts } from './js/tts.js';
import { performSearch } from './js/search.js';
import { blobToBase64 } from './js/utils.js';
import { downloadFlipbookAsHtml } from './js/download.js';


// --- Main App Logic ---

async function handleGenerate() {
    if (!state.currentContentSource.value) {
        showError("No content source selected. Please upload a file or paste text.");
        return;
    }
    
    showLoader();
    dom.fileNameDisplay.textContent = '';
    
    try {
        const coverImageInput = dom.coverImageInput.files?.[0];
        const coverImageBase64 = coverImageInput ? await blobToBase64(coverImageInput) : null;

        const theme = document.querySelector('.theme-btn.active')?.dataset.theme || 'default';

        const options = {
            theme: theme,
            narration: dom.narrationToggle.checked,
            cover: {
                title: dom.coverTitle.value,
                author: dom.coverAuthor.value,
                image: coverImageBase64,
            }
        };

        let content;
        if (state.currentContentSource.type === 'text') {
            updateLoaderProgress(50);
            content = await Promise.resolve(state.currentContentSource.value);
            updateLoaderProgress(90);

        } else { // It's a file
            const onProgress = (percentage) => updateLoaderProgress(percentage);
            content = await processFile(state.currentContentSource.value, onProgress);
        }
        
        updateLoaderProgress(95);

        // Configure marked to open links in a new tab
        const renderer = new marked.Renderer();
        renderer.link = (href, title, text) => `<a target="_blank" rel="noopener" href="${href}" title="${title || ''}">${text}</a>`;
        marked.use({ renderer });

        let pages;
        if (Array.isArray(content)) {
            pages = content;
        } else if (typeof content === 'string') {
            const dirtyHtml = marked.parse(content, { breaks: true });
            // Sanitize HTML to prevent XSS
            const fullHtml = DOMPurify.sanitize(dirtyHtml, { ADD_ATTR: ['target'] });
            
            // Wait for fonts to be loaded and ready to prevent text overflow issues
            await document.fonts.ready;

            pages = paginateHtmlContent(fullHtml, theme);
        } else {
            throw new Error('Unsupported content type for flipbook generation.');
        }
        
        // Store all generated content and options in the central state
        state.flipbookContent.pages = pages;
        state.flipbookContent.options = options;
        state.flipbookContent.isImageBook = Array.isArray(content);
        state.searchablePages = getSearchablePages(pages, Array.isArray(content));
        
        setTimeout(() => {
            createFlipbook(); // Now reads from state
            updateLoaderProgress(100);
        }, 100);

    } catch (error) {
        showError(error.message || 'An unknown error occurred.');
    }
}

async function handleDownload() {
    const originalIconHTML = dom.downloadBtn.innerHTML;
    dom.downloadBtn.innerHTML = `<svg class="loading-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
    dom.downloadBtn.disabled = true;
    try {
        await downloadFlipbookAsHtml();
    } catch (err) {
        console.error("Download failed:", err);
        alert(`Could not generate the download file. ${err.message}`);
    } finally {
        dom.downloadBtn.innerHTML = originalIconHTML;
        dom.downloadBtn.disabled = false;
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
        const target = event.target;
        const file = target.files?.[0];
        if (!file) return;
        dom.fileNameDisplay.textContent = `Selected: ${file.name}`;
        state.currentContentSource = { type: 'file', value: file };
        updateGenerateButtonState();
        target.value = ''; // Reset for same-file upload
    });
    
    // Drag and Drop
    const dropzone = dom.dropzoneLabel;
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragging'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragging');
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        dom.fileNameDisplay.textContent = `Selected: ${file.name}`;
        state.currentContentSource = { type: 'file', value: file };
        updateGenerateButtonState();
    });

    // Text input
    dom.textInput.addEventListener('input', () => {
        const text = dom.textInput.value.trim();
        state.currentContentSource = text ? { type: 'text', value: dom.textInput.value } : { type: null, value: null };
        updateGenerateButtonState();
    });
    
    // Customization
    dom.themeSelector.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('theme-btn')) {
            dom.themeSelector.querySelector('.active')?.classList.remove('active');
            target.classList.add('active');
        }
    });

    dom.coverImageInput.addEventListener('change', () => {
        const file = dom.coverImageInput.files?.[0];
        if (file) {
            dom.coverImageName.textContent = file.name;
            const reader = new FileReader();
            reader.onload = (e) => {
                dom.coverImagePreview.src = e.target.result;
                dom.coverImagePreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            dom.coverImageName.textContent = 'No file selected';
            dom.coverImagePreview.src = '#';
            dom.coverImagePreviewContainer.classList.add('hidden');
        }
    });

    // Generate Button
    dom.generateBtn.addEventListener('click', handleGenerate);

    // Flipbook controls
    dom.prevPageBtn.addEventListener('click', flipPrevPage);
    dom.nextPageBtn.addEventListener('click', flipNextPage);
    dom.createNewBtn.addEventListener('click', () => {
        resetView();
        state.currentContentSource = { type: null, value: null };
        updateGenerateButtonState();
    });
    dom.fullscreenBtn.addEventListener('click', toggleFullScreen);
    dom.downloadBtn.addEventListener('click', handleDownload);
    
    // Search
    dom.searchBtn.addEventListener('click', performSearch);
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch();
    });
     document.addEventListener('click', (e) => {
        if (!dom.searchContainer.contains(e.target)) {
            dom.searchResults.classList.add('hidden');
        }
    });

    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', handleFullScreenChange);

    // Initialize UI Effects
    addSparkleEffect(dom.generateBtn);
    addSparkleEffect(dom.createNewBtn);

    // Initialize Gemini-powered features
    initTts();
}

// --- App Initialization ---

document.addEventListener('DOMContentLoaded', initEventListeners);