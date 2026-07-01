import axios, {
  AxiosRequestConfig,
  type AxiosError,
  type AxiosInstance,
} from "axios";

// here in createApi client getToken is recieved by the function as arguement

export function createApiClient(
  getToken: () => Promise<string | null>,
): AxiosInstance {
  // this creates custom axios instance . all request will use this base url
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000",
    withCredentials: false,
  });

  // interceptor runs before every request , here we use it ot add the authentication token automatically
  client.interceptors.request.use(async (config) => {
    const token = await getToken();
    // fetches the token from clerk

    if (token) {
      //This allows the backend to verify the user.
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      console.error("API Error:", error);
      return Promise.reject(error);
    },
  );
  return client;
}

export async function apiGet<T>(
  client: AxiosInstance,
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await client.get<{ data: T }>(url, config);
  return response.data.data;
}

export async function apiPatch<TBody, TResponse>(
  client: AxiosInstance,
  url: string,
  body: TBody,
  config?: AxiosRequestConfig
): Promise<TResponse> {
  const response = await client.patch<{ data: TResponse }>(url, body, config);
  return response.data.data;
}

/*
This file creates a reusable Axios API client for communicating with the backend.

Purpose:
Instead of configuring axios (base URL, token, headers, error handling) in every API call,
we create a single pre-configured Axios instance and reuse it across the application.

How it works:

1. createApiClient(getToken)
  - Creates a custom axios instance using axios.create().
  - Sets the base URL for all API requests.
  - Accepts a getToken() function that returns the user's authentication token.

2. Request Interceptor
  - Runs before every request is sent.
  - Retrieves the authentication token using getToken().
  - If a token exists, it attaches it to the Authorization header as:
    Authorization: Bearer <token>
  - This allows the backend to verify the user automatically.

3. Response Interceptor
  - Runs after the response is received.
  - If the request fails, it logs the error and forwards it so the calling code can handle it.
4. apiGet<T>()
  - A generic helper function for GET requests.
  - T represents the expected response type.
  - Assumes backend responses follow this structure:
      { data: T }
  - Returns only the actual data instead of the full Axios response object.
5. apiPatch<TBody, TResponse>()
  - A generic helper function for PATCH requests.
  - TBody is the type of the request body, and TResponse is the expected response type.
  - Similar to apiGet, it returns only the data from the response.

  

Benefits:
- Centralized API configuration
- Automatic token handling
- Cleaner and reusable API calls
- Consistent error handling
- Type-safe responses with TypeScript
*/
