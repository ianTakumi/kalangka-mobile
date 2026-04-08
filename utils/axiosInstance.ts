import axios from "axios";

const DEVELOPMENT_URL = "http://192.168.1.64:8080/api/";
const PRODUCTION_URL = "https://kalangka-756cdff24eb2.herokuapp.com/api/";

const client = axios.create({
  baseURL: __DEV__ ? DEVELOPMENT_URL : PRODUCTION_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default client;
