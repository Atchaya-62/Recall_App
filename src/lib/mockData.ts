import { Video, Flashcard, Folder } from '@/types';

export const mockFolders: Folder[] = [
  { id: '1', userId: '1', name: 'Frontend Development', createdAt: '2024-01-15', videoCount: 3, color: 'amber' },
  { id: '2', userId: '1', name: 'Backend & APIs', createdAt: '2024-01-10', videoCount: 2, color: 'orange' },
  { id: '3', userId: '1', name: 'Data Structures & Algorithms', createdAt: '2024-01-05', videoCount: 1, color: 'emerald' },
];

export const mockVideos: Video[] = [
  {
    id: '1',
    userId: '1',
    folderId: '1',
    youtubeUrl: 'https://www.youtube.com/watch?v=dpw9EHDh2bM',
    videoId: 'dpw9EHDh2bM',
    title: 'React Hooks Deep Dive - Complete Guide',
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop',
    summary: 'This comprehensive guide explores React Hooks in depth, covering useState, useEffect, useContext, and custom hooks. Learn how to manage state, handle side effects, and build reusable logic. The video demonstrates best practices, common pitfalls, and advanced patterns for creating scalable React applications.',
    notes: [
      'useState returns array with state value and setter function',
      'useEffect handles side effects and cleanup operations',
      'useContext provides access to global context without prop drilling',
      'Custom hooks enable logic reuse across components',
      'Rules of Hooks: only call at top level, only in React functions',
      'Dependency arrays control when effects re-run',
      'Multiple useState calls are better than complex state objects'
    ],
    createdAt: '2024-03-25T10:30:00Z',
    watched: true,
    duration: '42:18'
  },
  {
    id: '2',
    userId: '1',
    folderId: '1',
    youtubeUrl: 'https://www.youtube.com/watch?v=bMknfKXIFA8',
    videoId: 'bMknfKXIFA8',
    title: 'Advanced State Management Patterns',
    thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=225&fit=crop',
    summary: 'Explore advanced state management techniques beyond basic useState. This tutorial covers useReducer for complex state logic, Context API patterns, and integration with external state management libraries. Learn when to use different approaches and how to structure state for large applications.',
    notes: [
      'useReducer is better for complex state with multiple sub-values',
      'Context prevents prop drilling but can cause unnecessary re-renders',
      'Split context by update frequency to optimize performance',
      'Combine useReducer with Context for global state',
      'Use selectors to prevent over-rendering in context consumers'
    ],
    createdAt: '2024-03-23T14:20:00Z',
    watched: false,
    duration: '28:45'
  },
  {
    id: '3',
    userId: '1',
    folderId: '2',
    youtubeUrl: 'https://www.youtube.com/watch?v=fgTGADljAeg',
    videoId: 'fgTGADljAeg',
    title: 'Building RESTful APIs with Node.js & Express',
    thumbnail: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
    summary: 'Learn how to build production-ready RESTful APIs using Node.js and Express. This tutorial covers routing, middleware, error handling, authentication, and database integration. Understand REST principles, HTTP methods, status codes, and best practices for API design and security.',
    notes: [
      'Express middleware executes in order of definition',
      'Use HTTP status codes correctly: 200, 201, 400, 401, 404, 500',
      'Implement error handling middleware with 4 parameters',
      'JWT tokens for stateless authentication',
      'Validate request data before processing',
      'Use environment variables for sensitive configuration'
    ],
    createdAt: '2024-03-20T09:15:00Z',
    watched: true,
    duration: '1:15:30'
  },
];

export const mockFlashcards: Record<string, Flashcard[]> = {
  '1': [
    {
      id: 'f1',
      videoId: '1',
      question: 'What does useState return and how do you use it?',
      answer: 'useState returns an array with two elements: the current state value and a setter function. Use array destructuring to access them: const [count, setCount] = useState(0)',
      mastered: false
    },
    {
      id: 'f2',
      videoId: '1',
      question: 'When does useEffect run and how do you control it?',
      answer: 'useEffect runs after every render by default. Control it with a dependency array: empty array [] runs once on mount, specific dependencies run when those values change.',
      mastered: true
    },
    {
      id: 'f3',
      videoId: '1',
      question: 'What are the two Rules of Hooks?',
      answer: '1) Only call hooks at the top level (not in loops, conditions, or nested functions). 2) Only call hooks from React function components or custom hooks.',
      mastered: false
    },
    {
      id: 'f4',
      videoId: '1',
      question: 'How does useContext solve prop drilling?',
      answer: 'useContext allows components to access values from a Context Provider without passing props through every level of the component tree.',
      mastered: false
    },
    {
      id: 'f5',
      videoId: '1',
      question: 'When should you create a custom hook?',
      answer: 'Create custom hooks when you have stateful logic that needs to be reused across multiple components. Custom hooks must start with "use" and can call other hooks.',
      mastered: true
    }
  ],
  '2': [
    {
      id: 'f6',
      videoId: '2',
      question: 'When should you use useReducer instead of useState?',
      answer: 'Use useReducer when you have complex state logic involving multiple sub-values or when the next state depends on the previous one. It provides more predictable state updates.',
      mastered: false
    },
    {
      id: 'f7',
      videoId: '2',
      question: 'How can Context API cause performance issues?',
      answer: 'When Context value changes, all components consuming that context re-render, even if they only use a small part of the data. Split contexts by update frequency to optimize.',
      mastered: false
    },
    {
      id: 'f8',
      videoId: '2',
      question: 'What is the recommended pattern for global state with hooks?',
      answer: 'Combine useReducer for state logic with Context API for distribution. Create separate contexts for state and dispatch to prevent unnecessary re-renders.',
      mastered: false
    },
    {
      id: 'f9',
      videoId: '2',
      question: 'How do selectors prevent over-rendering?',
      answer: 'Selectors extract only the needed data from context, so components only re-render when their specific data changes, not when any part of the context updates.',
      mastered: true
    },
    {
      id: 'f10',
      videoId: '2',
      question: 'What are the three parameters of a reducer function?',
      answer: 'A reducer takes the current state and an action object, then returns the new state based on the action type: (state, action) => newState',
      mastered: false
    }
  ],
  '3': [
    {
      id: 'f11',
      videoId: '3',
      question: 'What are the main HTTP methods used in REST APIs?',
      answer: 'GET (retrieve data), POST (create data), PUT/PATCH (update data), DELETE (remove data). GET and DELETE are idempotent.',
      mastered: false
    },
    {
      id: 'f12',
      videoId: '3',
      question: 'How do you create error handling middleware in Express?',
      answer: 'Define middleware with 4 parameters (err, req, res, next). Place it after all other middleware and routes. Express recognizes the 4-parameter signature as error handling.',
      mastered: false
    },
    {
      id: 'f13',
      videoId: '3',
      question: 'What status code should you return for a successful POST request?',
      answer: '201 Created - indicates the request succeeded and a new resource was created. Include the new resource in the response body.',
      mastered: true
    },
    {
      id: 'f14',
      videoId: '3',
      question: 'How do JWT tokens enable stateless authentication?',
      answer: 'JWTs contain encoded user data and a signature. The server can verify the token without database lookups. Include user ID and expiration in the payload.',
      mastered: false
    },
    {
      id: 'f15',
      videoId: '3',
      question: 'Why validate request data before processing?',
      answer: 'Validation prevents security vulnerabilities, data corruption, and application crashes. Return 400 Bad Request with clear error messages for invalid data.',
      mastered: false
    }
  ]
};

// Helper function to get flashcards for a video
export const getFlashcardsForVideo = (videoId: string): Flashcard[] => {
  return mockFlashcards[videoId] || [];
};

// Helper function to get videos by folder
export const getVideosByFolder = (folderId: string): Video[] => {
  return mockVideos.filter(video => video.folderId === folderId);
};

// Helper to extract YouTube video ID from URL
export const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
};
