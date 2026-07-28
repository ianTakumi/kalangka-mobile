import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVELOPMENT_URL = "http://192.168.1.64:8080/api/";
const PRODUCTION_URL = "https://kalangka-756cdff24eb2.herokuapp.com/api/";
// const PRODUCTION_URL = "https://apitest.prutasph.com/api";

const client = axios.create({
  baseURL: __DEV__ ? DEVELOPMENT_URL : PRODUCTION_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
client.interceptors.request.use(
  async (config) => {
    try {
      // Get token from AsyncStorage
      const token = await AsyncStorage.getItem("token");

      // If token exists, add it to headers
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    } catch (error) {
      console.error("Error in request interceptor:", error);
      return config;
    }
  },
  (error) => {
    // Handle request error
    return Promise.reject(error);
  },
);

export default client;
