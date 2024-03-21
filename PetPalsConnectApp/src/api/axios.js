import axios from "axios";

// Use environment variable for the base URL
const baseURL = process.env.REACT_APP_API_URL || "http://localhost:4000";

const instance = axios.create({
  baseURL: baseURL,
  timeout: 10000, // Set default timeout
});

// Add a request interceptor
instance.interceptors.request.use(
  function (config) {
    // Do something before request is sent, like adding an auth token
    const token = localStorage.getItem("token");
    config.headers.Authorization = token ? `Bearer ${token}` : "";
    return config;
  },
  function (error) {
    // Do something with request error
    return Promise.reject(error);
  }
);

// Add a response interceptor
instance.interceptors.response.use(
  function (response) {
    // Any status code that lies within the range of 2xx cause this function to trigger
    return response;
  },
  function (error) {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    return Promise.reject(error);
  }
);

export default instance;
