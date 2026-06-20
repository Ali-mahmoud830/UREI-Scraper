export const getApiUrl = () => {
    // Falls back to the HuggingFace URL if NEXT_PUBLIC_API_URL is not provided
    return process.env.NEXT_PUBLIC_API_URL || "https://ali-mahmoud-830-urei-scraper-api.hf.space";
};

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${getApiUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    return fetch(url, options);
};
