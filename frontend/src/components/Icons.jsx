
import React from "react";

export const Icons = {
  Leaf: (p)=>(
    <svg {...p} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8 6 2 10 2 17c0 4 4 5 10 5s10-1 10-5c0-7-6-11-10-15z"/>
    </svg>
  ),
  User: (p)=>(
    <svg {...p} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a7 7 0 110 14 7 7 0 010-14zm0 16c-6 0-10 3-10 5v1h20v-1c0-2-4-5-10-5z"/>
    </svg>
  ),
  Shield: (p)=>(
    <svg {...p} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l9 4v6c0 5-3.5 9.7-9 12-5.5-2.3-9-7-9-12V6l9-4z"/>
    </svg>
  ),
  Plant: (p)=>(
    <svg {...p} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 22v-6c-4 0-6-2-6-6 2 2 4 2 6 2V4l3 1 3-1v8c0 4-2 6-6 6v6h-0z"/>
    </svg>
  ),
  Trophy: (p)=>(
    <svg {...p} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 3h-2V2H9v1H7c-1 0-2 1-2 2v2c0 2 1.5 4 3.5 4.7C9 14 11 15 12 15s3-1 3.5-3.3C17.5 11 19 9 19 7V5c0-1-1-2-2-2zM6 19h12v2H6v-2z"/>
    </svg>
  ),
  File: (p)=>(
    <svg {...p} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 2h9l5 5v15c0 1-1 2-2 2H6c-1 0-2-1-2-2V4c0-1 1-2 2-2z"/>
    </svg>
  )
};
