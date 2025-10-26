import { dom } from './dom.js';
import { state } from './state.js';
import { getFlipbookInstance } from './flipbook.js';

export function showLoader() {
    dom.appContainer.classList.add('flipbook-active');
    dom.loader.classList.remove('hidden');
    dom.welcomeMessage.classList.add('hidden');
    dom.errorDisplay.classList.add('hidden');
    dom.flipbookWrapper.classList.add('hidden');
    updateLoaderProgress(0); // Reset progress bar
}

export function updateLoaderProgress(percentage) {
    const p = Math.round(percentage);
    dom.loaderProgress.style.width = `${p}%`;
    dom.loaderProgressText.textContent = `${p}%`;
    const progressBarContainer = dom.loaderProgress.parentElement;
    if(progressBarContainer) {
        progressBarContainer.setAttribute('aria-valuenow', p);
    }
}

export function showError(message) {
    dom.errorMessage.textContent = message;
    dom.errorDisplay.classList.remove('hidden');
    dom.loader.classList.add('hidden');
    dom.welcomeMessage.classList.add('hidden');
    dom.flipbookWrapper.classList.add('hidden');
    dom.appContainer.classList.remove('flipbook-active'); // Go back to input view on error
}

export function showFlipbook() {
    dom.flipbookWrapper.classList.remove('hidden');
    dom.loader.classList.add('hidden');
    dom.welcomeMessage.classList.add('hidden');
    dom.errorDisplay.classList.add('hidden');
}

export function resetView() {
    dom.appContainer.classList.remove('flipbook-active');
    dom.welcomeMessage.classList.remove('hidden');
    dom.flipbookWrapper.classList.add('hidden');
    dom.errorDisplay.classList.add('hidden');
    dom.loader.classList.add('hidden');
    
    // Clear all inputs
    dom.textInput.value = '';
    dom.fileNameDisplay.textContent = '';
    dom.coverTitle.value = '';
    dom.coverAuthor.value = '';
    dom.coverImageInput.value = '';
    dom.coverImageName.textContent = 'No file selected';
    dom.coverImagePreviewContainer.classList.add('hidden');
    dom.narrationToggle.checked = false;

    dom.generateBtn.disabled = true;

    // Return focus to the first tab for accessibility
    dom.fileTabBtn.focus();
}

export function switchTab(mode) {
    const isFileMode = mode === 'file';

    // Update button states
    dom.fileTabBtn.classList.toggle('active', isFileMode);
    dom.fileTabBtn.setAttribute('aria-selected', isFileMode);
    
    dom.textTabBtn.classList.toggle('active', !isFileMode);
    dom.textTabBtn.setAttribute('aria-selected', !isFileMode);

    // Update view visibility
    dom.fileUploadView.classList.toggle('hidden', !isFileMode);
    dom.textPasteView.classList.toggle('hidden', isFileMode);
}


export function addSparkleEffect(button) {
    button.addEventListener('mousemove', (e) => {
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        button.style.setProperty('--x', `${x}px`);
        button.style.setProperty('--y', `${y}px`);
    });
}

export function updateGenerateButtonState() {
    dom.generateBtn.disabled = !state.currentContentSource.value;
}

export function handleTabKeydown(e) {
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

export function toggleFullScreen() {
    if (!document.fullscreenElement) {
        dom.appContainer.requestFullscreen().catch(err => {
            alert(`Full-screen mode could not be activated: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

export function handleFullScreenChange() {
    const isFullScreen = !!document.fullscreenElement;
    document.body.classList.toggle('fullscreen-active', isFullScreen);
    dom.enterFullscreenIcon.classList.toggle('hidden', isFullScreen);
    dom.exitFullscreenIcon.classList.toggle('hidden', !isFullScreen);
    dom.fullscreenBtn.setAttribute('aria-label', isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen');
    setTimeout(() => getFlipbookInstance()?.update(), 150);
}