export const getToken = () => sessionStorage.getItem('token');
export const setToken = (t) => sessionStorage.setItem('token', t);
export const clearToken = () => sessionStorage.removeItem('token');
