import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import Dashboard from '@/pages/Dashboard';
import Folder from '@/pages/Folder';
import VideoDetail from '@/pages/VideoDetail';
import FlashcardReview from '@/pages/FlashcardReview';
import Challenges from '@/pages/Challenges';
import ProcessVideo from '@/pages/ProcessVideo';
import Profile from '@/pages/Profile';
import CourseGenerator from '@/pages/CourseGenerator';
import Courses from '@/pages/Courses';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ResetPassword from '@/pages/ResetPassword';
import { Toaster } from '@/components/ui/sonner';
import PlatformLearningTracker from '@/components/PlatformLearningTracker';

export default function App() {
  return (
    <BrowserRouter>
      <PlatformLearningTracker />
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navbar />
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/folders"
            element={
              <ProtectedRoute>
                <Navbar />
                <Folder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/folder/:id"
            element={
              <ProtectedRoute>
                <Navbar />
                <Folder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/video/:id"
            element={
              <ProtectedRoute>
                <Navbar />
                <VideoDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/flashcards"
            element={
              <ProtectedRoute>
                <Navbar />
                <FlashcardReview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/challenges"
            element={
              <ProtectedRoute>
                <Navbar />
                <Challenges />
              </ProtectedRoute>
            }
          />
          <Route
            path="/process"
            element={
              <ProtectedRoute>
                <Navbar />
                <ProcessVideo />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Navbar />
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/course-generator"
            element={
              <ProtectedRoute>
                <Navbar />
                <CourseGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses"
            element={
              <ProtectedRoute>
                <Navbar />
                <Courses />
              </ProtectedRoute>
            }
          />

          {/* Fallback route */}
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <Navbar />
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
        <Toaster />
      </div>
    </BrowserRouter>
  );
}
