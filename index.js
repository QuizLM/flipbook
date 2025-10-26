
import { dom } from './js/dom.js';
import { showLoader, showError, showFlipbook, updateLoaderProgress, resetView, switchTab } from './js/ui.js';
import { processFile } from './js/content.js';
import { createFlipbook, flipPrevPage, flipNextPage, paginateHtmlContent, getFlipbookInstance, getSearchablePages, flipToPage } from './js/flipbook.js';
import { initTts } from './js/tts.js';

// --- State Management ---
let currentContentSource = { type: null, value: null }; // type: 'file' or 'text'
let searchablePages = [];

// --- Main App Logic ---

async function handleGenerate() {
    if (!currentContentSource.value) {
        showError("No content source selected. Please upload a file or paste text.");
        return;
    }
    
    showLoader();
    dom.fileNameDisplay.textContent = '';
    
    try {
        const coverImageInput = dom.coverImageInput.files?.[0];
        const coverImageBase64 = coverImageInput ? await fileToBase64(coverImageInput) : null;

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
        if (currentContentSource.type === 'text') {
            updateLoaderProgress(50);
            content = await Promise.resolve(currentContentSource.value);
            updateLoaderProgress(90);

        } else { // It's a file
            const onProgress = (percentage) => updateLoaderProgress(percentage);
            content = await processFile(currentContentSource.value, onProgress);
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
            const fullHtml = marked.parse(content, { breaks: true });
            
            // Wait for fonts to be loaded and ready to prevent text overflow issues
            await document.fonts.ready;

            pages = paginateHtmlContent(fullHtml, theme);
        } else {
            throw new Error('Unsupported content type for flipbook generation.');
        }
        
        searchablePages = getSearchablePages(pages, Array.isArray(content));
        
        setTimeout(() => {
            createFlipbook(pages, options);
            updateLoaderProgress(100);
        }, 100);

    } catch (error) {
        showError(error.message || 'An unknown error occurred.');
    }
}

// --- Search Logic ---
function performSearch() {
    const query = dom.searchInput.value.trim().toLowerCase();
    if (!query) {
        dom.searchResults.classList.add('hidden');
        return;
    }
    
    const results = [];
    searchablePages.forEach((pageText, index) => {
        if (pageText.toLowerCase().includes(query)) {
            results.push(index);
        }
    });
    
    displaySearchResults(results);
}

function displaySearchResults(results) {
    dom.searchResults.innerHTML = '';
    if (results.length === 0) {
        dom.searchResults.innerHTML = '<p>No results found.</p>';
    } else {
        results.forEach(pageIndex => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.textContent = `Page ${pageIndex + 1}`;
            item.addEventListener('click', () => {
                flipToPage(pageIndex);
                dom.searchResults.classList.add('hidden');
                dom.searchInput.value = '';
            });
            dom.searchResults.appendChild(item);
        });
    }
    dom.searchResults.classList.remove('hidden');
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

// --- Helpers ---
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function updateGenerateButtonState() {
    dom.generateBtn.disabled = !currentContentSource.value;
}

// --- Keyboard Navigation ---

function handleTabKeydown(e) {
    const tabs = [dom.fileTabBtn, dom.textTabBtn];
    const activeIndex = tabs.findIndex(tab => tab === document.activeElement);
    if (activeIndex === -1) return;
    let newIndex = -1;
    if (e.key === 'ArrowRight') newIndex = (activeIndex + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') newIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    if (newIndex !== -1) {
        e.preventDefault();
        const newTab = tabs[newIndex];
        switchTab(newTab.dataset.mode);
        newTab.focus();
    }
}

// --- Full Screen Mode ---

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        dom.appContainer.requestFullscreen().catch(err => {
            alert(`Full-screen mode could not be activated: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function handleFullScreenChange() {
    const isFullScreen = !!document.fullscreenElement;
    document.body.classList.toggle('fullscreen-active', isFullScreen);
    dom.enterFullscreenIcon.classList.toggle('hidden', isFullScreen);
    dom.exitFullscreenIcon.classList.toggle('hidden', !isFullScreen);
    dom.fullscreenBtn.setAttribute('aria-label', isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen');
    setTimeout(() => getFlipbookInstance()?.update(), 150);
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
        currentContentSource = { type: 'file', value: file };
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
        currentContentSource = { type: 'file', value: file };
        updateGenerateButtonState();
    });

    // Text input
    dom.textInput.addEventListener('input', () => {
        const text = dom.textInput.value.trim();
        currentContentSource = text ? { type: 'text', value: dom.textInput.value } : { type: null, value: null };
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
        dom.coverImageName.textContent = file ? file.name : '';
    });

    // Generate Button
    dom.generateBtn.addEventListener('click', handleGenerate);

    // Flipbook controls
    dom.prevPageBtn.addEventListener('click', flipPrevPage);
    dom.nextPageBtn.addEventListener('click', flipNextPage);
    dom.createNewBtn.addEventListener('click', () => {
        resetView();
        currentContentSource = { type: null, value: null };
        updateGenerateButtonState();
    });
    dom.fullscreenBtn.addEventListener('click', toggleFullScreen);
    
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
