import './App.css'
import React, { useEffect, useState, useContext, useRef } from 'react';
import io from 'socket.io-client';

/**
 * Class representing the data related to Avatar's speech.
* @property {Array} audioQueue - The queue of audio data.
* @property {Array} wordQueue - The queue of words.
* @property {Array} visemeQueue - The queue of visemes.
* @property {Array} animation - The array of animations.
* @property {string} text - The text of the speech.
* @property {number} speechId - The ID of the speechData.
* @property {string} gptId - The gptId of the speechData.
* @property {boolean} generationComplete - Flag to check if the generation is complete.
* @property {boolean} playing - Flag to check if the speech is currently playing.
* @property {boolean} played - Flag to check if the speech has been played.
* @property {number} playbackTime - The playback time of the speech.
* @property {AudioBufferSourceNode} source - The source responsible for playback.
 */
class AvatarSpeechData {
  /**
   * Create a new AvatarSpeechData object.
   */
  constructor(gptId, text) {
    /**
     * The queue of audio data.
     * @type {Array}
     */
    this.audioQueue = [];

    /**
     * The queue of words.
     * @type {Array}
     */
    this.wordQueue = [];

    /**
     * The queue of visemes.
     * @type {Array}
     */
    this.visemeQueue = [];

    /**
     * The array of animations.
     * @type {Array}
     */
    this.animation = [];

    /**
     * The text of the speech.
     * @type {string}
     */
    this.text = text;

    /**
     * The ID of the speech.
     * @type {number}
     */
    this.speechId = 0;

    /**
     * The gptId of the speechData.
     * @type {number}
     */
    this.gptId = gptId;

    /**
     * Flag to check if the generation is complete.
     * @type {boolean}
     */
    this.generationComplete = false;

    /**
     * Flag to check if the speech is currently playing.
     * @type {boolean}
     */
    this.playing = false;

    /**
     * Flag to check if the speech has been played.
     * @type {boolean}
     */
    this.played = false;

    /**
     * The playback time of the speech.
     * @type {number}
     */
    this.playbackTime = 0;

    /**
     * source responsible for playback
     * @type {AudioBufferSourceNode}
    */
    this.source = null;
  }

  /**
   * Function to clear the arrays and queue to save on RAM.
   */
  clearData() {
    this.audioQueue = [];
    this.wordQueue = [];
    this.visemeQueue = [];
    this.animation = [];
  }

  // Any other methods related to the speech functionality can also go here
}



const AudioTest = ({ }) => {
  // Socket reference
  const socket = useRef(null);
  // Audio context and gain node for volzume control
  const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 }));


  // State for status label
  const [statusLabel, setStatusLabel] = useState('');

  // State for connection status, audio started status, and speech API status
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  let isPlaying = useRef(false);
  let startTime = useRef(0);
  const avatarSpeechDataRef = useRef({});
  /**
 * This useEffect hook is responsible for setting up the socket connection and event listeners.
 * It also disconnects the socket when the component is unmounted.
 */
  useEffect(() => {
    // URL for the backend server
    let url = "https://staging-instage-ai.instage.io"

    // Initialize the socket connection
    socket.current = io(url, {
      withCredentials: true
    });

    // Set up event listeners for the socket
    socket.current.on('synthesis-started', handleSynthesisStarted);
    socket.current.on('synthesis-completed', handleSynthesisCompleted);
    socket.current.on('synthesis-error', handleSynthesisError);
    socket.current.on('audio-broadcast', handleAudioBroadcast);
    //socket.current.on('visemes', handleVisemes);
    //socket.current.on('words', handleWords);

    socket.current.on('connect', handleConnect);
    socket.current.on('disconnect', handleDisconnect);
    //add listener for deepgram-connection-error
    // socket.current.on('deepgram-connection-error', () => {
    //     console.log('deepgram-connection-error')
    //     stopDeepGram()
    // }
    //);
    // Fetch the audio
    //getAudio();

    // Disconnect the socket when the component is unmounted
    return () => {
      if (socket && socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  /**
  * emitSynthesizeSpeech is a function that emits a 'SynthesizeSpeech' event to the socket.
  * @param {AvatarSpeechData} data - The AvatarSpeechData object.
  */
  function emitSynthesizeSpeech(data) {
    socket.current.emit('SynthesizeSpeech', { speechId: data.speechId, voice: "Azilea", text: data.text });
  }
  /**
   * handleSynthesisStarted is a function that is called when the synthesis starts.
   * @param {number} speechId - The ID of the speech.
   */
  const handleSynthesisStarted = ({ speechId }) => { };

  /**
   * handleSynthesisCompleted is a function that is called when the synthesis is completed.
   * It sets the generationComplete property of the AvatarSpeechData object to true.
   * @param {number} speechId - The ID of the speech.
   */
  const handleSynthesisCompleted = ({ speechId }) => {
    let currentSpeechData = getAvatarSpeechData(speechId);
    currentSpeechData.generationComplete = true;
    // Check if the next speechData needs to be synthesized
    let nextSpeechData = getAvatarSpeechData(speechId + 1);

    if (nextSpeechData && !nextSpeechData.generationComplete) {
      emitSynthesizeSpeech(nextSpeechData)
    }
  };
  /**
     * called from the socket when audio data is received
     * @param {*} param0 
     */
  function handleAudioBroadcast({ speechId, audioData }) {
    console.log('handleAudioBroadcast', "speechId ", speechId)
    let adjustedLength = audioData.byteLength - (audioData.byteLength % 4);
    let trimmedBuffer = audioData.slice(0, adjustedLength);
    const pcmData = new Int16Array(trimmedBuffer);
    const floatData = new Float32Array(pcmData.length);

    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 32768.0; // Convert from 16-bit PCM to float
    }

    let avatarSpeechData = getAvatarSpeechData(speechId);
    avatarSpeechData.audioQueue.push(floatData); // Add the audio data to the queue

    if (!isPlaying.current) { // If audio is not already playing, start playing
      avatarSpeechData.playing = true;
      isPlaying.current = true;






      playNextAudio(speechId);
    }
  }

  /**
   * This function plays the next audio in the queue for a given speech ID.
   * It checks if the audio queue is empty. If it is, it sets the playing and played status to false and true respectively.
   * It also sets the audio started status to false and returns.
   * If the audio queue is not empty, it shifts the first audio data from the queue and checks if it is mostly silence.
   * If it is, it handles the silence case and returns.
   * If it is not, it creates a buffer and a source, and starts playing the audio.
   * It also sets up an onended event listener for the source to play the next audio when the current one ends.
   * 
   * @param {string} speechId - The ID of the speech.
   */
  function playNextAudio(speechId, prevDuration = 0) {
    /**
     * @type {AvatarSpeechData}
     */
    let data = getAvatarSpeechData(speechId);

    // If the audio queue is empty
    if (data.audioQueue.length === 0) {
      // Set the playing and played status
      data.playing = false;
      data.played = true;
      isPlaying.current = false;
      let nextSpeechId = speechId + 1;

      let nextData = getAvatarSpeechData(nextSpeechId);

      if (nextData != undefined && nextData.gptId == data.gptId) {
        characterRef.current.UpdateAnimations("test QUOTE", nextData.animation);

        // Crossfade by reducing overlapTime gradually
        let initialOverlapTime = 0.06; // Initial overlap time
        let fadeDuration = 1000000; // Crossfade duration in milliseconds

        function crossfade() {
          if (initialOverlapTime > 0) {
            // Fade in the current source
            gainNode.gain.setValueAtTime(0, audioContext.current.currentTime);
            gainNode.gain.linearRampToValueAtTime(1, audioContext.current.currentTime + initialOverlapTime);

            // Fade out the next source
            nextGainNode.gain.setValueAtTime(1, audioContext.current.currentTime);
            nextGainNode.gain.linearRampToValueAtTime(0, audioContext.current.currentTime + initialOverlapTime);

            // Reduce overlapTime
            initialOverlapTime -= 0.005;
            setTimeout(crossfade, fadeDuration / (initialOverlapTime * 100000000));
          } else {
            // Remove the next source after crossfade
            nextSource.disconnect();
            nextGainNode.disconnect();

            // Setup a callback to run just before the audio ends
            setTimeout(() => {
              // playNextAudio(speechId);
            }, ((buffer.duration) * 1000) - 10); // Convert duration to milliseconds for setTimeout
          }
        }

        // Start the crossfade process
        crossfade();
      }

      return;
    }

    // Shift the first audio data from the queue
    const floatData = data.audioQueue.shift();

    // Create a buffer and a source
    const buffer = audioContext.current.createBuffer(1, floatData.length, audioContext.current.sampleRate);
    buffer.copyToChannel(floatData, 0);

    const gainNode = audioContext.current.createGain();
    gainNode.connect(audioContext.current.destination);

    const source = audioContext.current.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode); // Connect the source to the gain node instead of the destination directly
    data.source = source;

    // Overlap and Crossfade
    const overlapTime = 0.06; // Initial overlap time
    let currentTime = audioContext.current.currentTime;

    // Fade in the current source
    gainNode.gain.setValueAtTime(0, audioContext.current.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioContext.current.currentTime + overlapTime);

    if (prevDuration > 0) {
      // Crossfade by reducing overlapTime gradually
      let initialOverlapTime = overlapTime; // Initial overlap time
      let fadeDuration = 1000000; // Crossfade duration in milliseconds

      function crossfade() {
        if (initialOverlapTime > 0) {
          // Fade in the current source
          gainNode.gain.setValueAtTime(0, audioContext.current.currentTime);
          gainNode.gain.linearRampToValueAtTime(1, audioContext.current.currentTime + initialOverlapTime);

          // Fade out the next source
          nextGainNode.gain.setValueAtTime(1, audioContext.current.currentTime);
          nextGainNode.gain.linearRampToValueAtTime(0, audioContext.current.currentTime + initialOverlapTime);

          // Reduce overlapTime
          initialOverlapTime -= 0.005;
          setTimeout(crossfade, fadeDuration / (initialOverlapTime * 100000000));
        } else {
          // Remove the next source after crossfade
          nextSource.disconnect();
          nextGainNode.disconnect();
        }
      }

      // Start the crossfade process
      crossfade();
    }

    // Setup a callback to run just before the audio ends
    setTimeout(() => {
      // playNextAudio(speechId);
    }, ((buffer.duration) * 1000) - 10); // Convert duration to milliseconds for setTimeout

    // Set up an onended event listener for the source
    source.onended = () => {
      // When the audio ends, play the next audio
      //onAudioDataPlayed(speechId, buffer.duration)
      playNextAudio(speechId, prevDuration - buffer.duration);
    };

    // Start playing the audio
    source.start(currentTime + prevDuration);
  }

  /**
   * This function retrieves the AvatarSpeechData object associated with a given speech ID.
   * 
   * @param {number} speechId - The ID of the speech.
   * @returns {AvatarSpeechData} The AvatarSpeechData object associated with the given speech ID.
   */
  function getAvatarSpeechData(speechId) {
    return avatarSpeechDataRef.current[speechId];
  }
  /**
   * handleSynthesisError is a function that is called when there is an error in the synthesis.
   * It sets the generationComplete property of the AvatarSpeechData object to false.
   * @param {number} speechId - The ID of the speech.
   */
  const handleSynthesisError = ({ speechId }) => {
    getAvatarSpeechData(speechId).generationComplete = false;
  };
  /**
   * handleConnect is a function that is called when a connection is established.
   * It sets the connection status to 'Connected' and restarts the DeepGram service if the microphone is started.
   */
  const handleConnect = async () => {
    setConnectionStatus('Connected');

  };

  /**
   * handleDisconnect is a function that is called when a connection is disconnected.
   * It sets the connection status to 'Disconnected'.
   */
  const handleDisconnect = () => {
    setConnectionStatus('Disconnected');
  };

  const TriggerSpeech = () => {
    let text = "this is a test to showcase the poping and clicking sounds,this is a test to showcase the poping and clicking sounds"
    let data = new AvatarSpeechData(0, text)
    data.speechId = Object.keys(avatarSpeechDataRef.current).length;
    avatarSpeechDataRef.current[data.speechId] = data;
    if (data.speechId > 0 && !avatarSpeechDataRef.current[data.speechId - 1].generationComplete) {
      console.log("Previous request is still being synthesized.");
      return;
    }
    emitSynthesizeSpeech(data);

  };
  return (
    <>
      <div>
        TEST
      </div>
      <div>
        {connectionStatus}
      </div>

      <button onClick={TriggerSpeech}>Trigger Speech</button>
    </>
  )

}

export default function App() {
  return (
    <main>
      <AudioTest />
      <br />
      React ⚛️ + Vite ⚡ + Replit 🌀
    </main>
  )
}
