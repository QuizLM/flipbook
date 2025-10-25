import { GoogleGenAI, Modality } from "@google/genai";

let ai;
let audioContext;
let currentSource = null;
const audioCache = new Map();

// --- Audio Decoding Helpers ---
function decode(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data, ctx, sampleRate, numChannels) {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// --- Public Functions ---
export function initTts() {
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    } catch (e) {
        console.error("Failed to initialize TTS module:", e);
        // This might fail if API_KEY is not set, but we proceed gracefully
        // The generate function will handle the error.
    }
}

function setButtonState(button, state) { // 'play', 'loading', 'stop'
    const icons = {
        play: button.querySelector('.play-icon'),
        loading: button.querySelector('.loading-icon'),
        stop: button.querySelector('.stop-icon'),
    };
    Object.values(icons).forEach(icon => icon.classList.add('hidden'));
    if (icons[state]) {
        icons[state].classList.remove('hidden');
    }
}

export async function generateAndPlayAudio(text, button) {
    if (!ai || !audioContext) {
        console.error("TTS module not initialized.");
        alert("Audio generation is not available. Please ensure your API key is configured.");
        return;
    }

    if (currentSource) {
        stopAllAudio();
        // If the same button was clicked, it means we're stopping it.
        if (button.classList.contains('playing')) {
             button.classList.remove('playing');
             setButtonState(button, 'play');
             return;
        }
    }
    
    // Reset any other playing buttons
    document.querySelectorAll('.narration-btn.playing').forEach(btn => {
        btn.classList.remove('playing');
        setButtonState(btn, 'play');
    });

    try {
        setButtonState(button, 'loading');
        button.classList.add('playing');

        let audioBuffer;
        if (audioCache.has(text)) {
            audioBuffer = audioCache.get(text);
        } else {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("No audio data received from API.");
            
            const audioBytes = decode(base64Audio);
            audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
            audioCache.set(text, audioBuffer);
        }

        playAudio(audioBuffer, () => {
             // onEnded callback
            setButtonState(button, 'play');
            button.classList.remove('playing');
        });
        setButtonState(button, 'stop');

    } catch (error) {
        console.error("Error generating or playing audio:", error);
        alert(`Could not generate audio: ${error.message}`);
        setButtonState(button, 'play');
        button.classList.remove('playing');
        stopAllAudio();
    }
}

function playAudio(audioBuffer, onEnded) {
    if (currentSource) {
        currentSource.stop();
    }
    currentSource = audioContext.createBufferSource();
    currentSource.buffer = audioBuffer;
    currentSource.connect(audioContext.destination);
    currentSource.onended = () => {
        currentSource = null;
        if (onEnded) onEnded();
    };
    currentSource.start();
}

export function stopAllAudio() {
    if (currentSource) {
        currentSource.stop();
        currentSource = null;
    }
     document.querySelectorAll('.narration-btn.playing').forEach(btn => {
        btn.classList.remove('playing');
        setButtonState(btn, 'play');
    });
}
