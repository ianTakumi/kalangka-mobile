import axios from "axios";
import { store } from "../redux/store"; // Import your store

const DEVELOPMENT_URL = "http://192.168.1.63:8080/api/";
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
      // Get token directly from Redux store (which is persisted)
      const state = store.getState();
      const token = state.auth.token;

      console.log("Token from Redux store:", token);
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
    return Promise.reject(error);
  },
);

export default client;
