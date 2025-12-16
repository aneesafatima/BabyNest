import { Alert } from "react-native";
import { initLlama, releaseAllLlama } from "llama.rn";
import RNFS from "react-native-fs"; //this is a file system library for react native; It performs all operations on the files
//in the mobile device and not on the file system in the computer
import axios from "axios";
import DeviceInfo from "react-native-device-info";
import {MODEL_NAME, HF_TO_GGUF, GGUF_FILE} from "@env";

let context = null;

const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const responseCache = new Map();

const setCache = (key, value) => {
  // Enforce size limit
  if (responseCache.size >= MAX_CACHE_SIZE) {
        const firstKey = responseCache.keys().next().value;
        responseCache.delete(firstKey);
  }
  responseCache.set(key, { value, timestamp: Date.now() });
};


const getCache = (key) => {
  const entry = responseCache.get(key);
  if (!entry) return null;

  // Check expiration
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
};

export const fetchAvailableGGUFs = async () => {
  try {
    const repoPath = HF_TO_GGUF; //This is a hugging face repo path for the guff files
    if (!repoPath) 
        throw new Error(`No repository mapping found for ${MODEL_NAME}`);

    const response = await axios.get(`https://huggingface.co/api/models/${repoPath}`);
    //This endpoint returns metadata about the model repo,
    if (!response.data?.siblings) 
      //sibligns key contains the list of files in the repo. This is hugging face specific terminology.
        throw new Error("Invalid API response format");
      /*"siblings": [
  { "rfilename": "phi-2.Q2_K.gguf" },
  { "rfilename": "phi-2.Q4_K_M.gguf" },
  { "rfilename": "phi-2.Q8_0.gguf" },
  { "rfilename": "README.md" },
  { "rfilename": "config.json" }
] This is the format */
    return response.data.siblings.filter(file => file.rfilename.endsWith(".gguf")).map(file => file.rfilename);
  } catch (error) {
    Alert.alert("Error", error.message || "Failed to fetch .gguf files");
    return [];
  }
};

export const checkMemoryBeforeLoading = async (modelPath) => {
  const stats = await RNFS.stat(modelPath);
  const fileSizeMB = stats.size / (1024 * 1024);
  const availableMemoryMB = (await DeviceInfo.getFreeDiskStorage()) / (1024 * 1024);

  if (fileSizeMB > availableMemoryMB * 0.8) {
    Alert.alert("Low Memory", "The model may be too large to load!");
    return false;
  }

  if(fileSizeMB < 100){
    Alert.alert("Corrupted Model", "The model may be corrupted. Please download again.");
    return false;
  }
  return true;
};

export const downloadModel = async (fileName, onProgress) => {
  //THIS METHOD IS USED TO DOWNLOAD THE MODEL FILE FROM HUGGING FACE TO THE MOBILE DEVICE WHEN THE APP FIRST RUNS
  //IF THE MODEL FILE ALREADY EXISTS IN THE DEVICE, IT WILL NOT DOWNLOAD IT AGAIN. WHICH MEANS PER DEVICE ONLY ONE DOWNLOAD IS NEEDED.
  const downloadUrl = `https://huggingface.co/${HF_TO_GGUF}/resolve/main/${fileName}`;
  const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
  // RNFS.DocumentDirectoryPath gives the abs path to the app's document directory on the device

  if (await RNFS.exists(destPath)) {
    await loadModel(fileName); //if the file already exists, we just load it; this probabaly happens only after once the app is already ran and the model is downloaded
    return destPath;
  }

  try {
    //THIS TRIES TO DOWNLAOD THE MODEL FILE FROM HUGGING FACE; IF DOWNLOAD FAILS, IT WILL THROW AN ERROR OTHERWISE IT WILL LOAD THE MODEL
    //CALLING THE loadModel METHOD 
    await RNFS.downloadFile({
      fromUrl: downloadUrl,
      toFile: destPath,
      progress: (res) => {
        if (res.contentLength > 0) onProgress(res.bytesWritten / res.contentLength);
      },
      background: true, //Allow the OS to continue this download even if the app goes into background
      discretionary: true, //Let the OS decide the best time to download based on device conditions(like WiFi, battery)
    }).promise; //If the URL returns bytes → RNFS writes those bytes.
    //the downloadFile method returns a task object and does not start the download until we call .promise on it.

    if (!(await RNFS.exists(destPath))) throw new Error("Download failed. File does not exist.");
    await loadModel(fileName);
    return destPath;
  } 
  catch (error) {
    Alert.alert("Error", error.message || "Failed to download model.");
  }
};

export const loadModel = async (modelName) => {
  try {
    const destPath = `${RNFS.DocumentDirectoryPath}/${modelName}`;
    if (!(await RNFS.exists(destPath))) {
      Alert.alert("Error", `Model file not found at ${destPath}`);
      return false;
    }

    if (context) {
      await releaseAllLlama();
      context = null;
    }

    if (!(await checkMemoryBeforeLoading(destPath))) return;

    //// Initial a Llama context with the model
    context = await initLlama({
        model: destPath, 
        n_ctx: 2048,
        n_gpu_layers: 0 
    });

    return true;
  } catch (error) {
    Alert.alert("Error Loading Model", error.message || "An unknown error occurred.");
    return false;
  }
};

export const generateResponse = async (conversation) => {
    if (!context) {
      Alert.alert("Model Not Loaded", "Please load the model first.");
      return null;
    }

    const lastMessage = conversation.filter(msg => msg.role === "user").pop();
    const cacheKey = lastMessage?.content?.trim();

    if (cacheKey) {
      const cachedResponse = getCache(cacheKey);
      if (cachedResponse) {
        console.log("Returning cached response for:", cacheKey);
        return cachedResponse;
      }
    }
  
    const stopWords = [
      "</s>", 
      "<|end|>", 
      "user:", 
      "assistant:", 
      "<|im_end|>", 
      "<|eot_id|>", 
      "<|end▁of▁sentence|>"
    ];
  
    try {
      // Check if conversation already has a system message
      const hasSystemMessage = conversation.some(msg => msg.role === "system");
      
      let messagesToSend = conversation;
      
      // If no system message exists, add a default pregnancy assistant prompt
      if (!hasSystemMessage) {
        const defaultSystemMessage = {
          role: "system",
          content: "You are a highly specialized AI assistant focused on pregnancy-related topics. " +
            "Your expertise includes maternal health, fetal development, prenatal care, and pregnancy well-being. " +
            "- Provide responses that are concise, clear, and easy to understand. " +
            "- Maintain a warm, empathetic, and supportive tone to reassure users. " +
            "- Prioritize factual, evidence-based information while keeping answers short. " +
            "- If a question is outside pregnancy-related topics, gently redirect the user to relevant discussions. " +
            "- Avoid unnecessary details, deliver crisp, to-the-point answers with care and compassion."
        };
        messagesToSend = [defaultSystemMessage, ...conversation];
      }
  
      const result = await context.completion({
        messages: messagesToSend,
        n_predict: 500,
        stop: stopWords
      });
  
      const response = result?.text?.trim();
      return response;

    } catch (error) {
      Alert.alert("Error During Inference", error.message || "An unknown error occurred.");
      return null;
    }
  };
  

