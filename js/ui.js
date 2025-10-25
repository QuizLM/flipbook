import { dom } from './dom.js';

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
    dom.coverImageName.textContent = '';
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
