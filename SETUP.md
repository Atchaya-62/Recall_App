# Recall App Setup Guide

## Complete Setup Instructions for Supabase Integration

This guide will walk you through setting up the complete Supabase backend for your Recall application, including database, authentication, and Edge Functions.

---

## Prerequisites

Before starting, ensure you have:
- A Google account (for Supabase and Google OAuth)
- Node.js installed (for running the app locally)
- Git installed
- A Google Cloud Console account (for Google AI API)

---

## Phase 1: Create Supabase Project

### 1.1 Create Supabase Account and Project

1. **Go to Supabase**
   - Visit https://supabase.com
   - Click "Start your project"
   - Sign up with your Google account

2. **Create New Project**
   - Click "New project"
   - Choose your organization
   - Set project name: `recall-app`
   - Set database password (save this!)
   - Choose region closest to you (e.g., US East, Europe West)
   - Click "Create new project"
   - Wait 2-3 minutes for database provisioning

3. **Get Project Credentials**
   - Go to Settings → API
   - Copy and save these values:
     - **Project URL**: `https://your-project-id.supabase.co`
     - **Anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
     - **Service role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (keep this secret!)

---

## Phase 2: Database Setup

### 2.1 Create Database Schema

1. **Open SQL Editor**
   - In your Supabase dashboard, go to "SQL Editor"
   - Click "New query"

2. **Run the Complete Schema Script**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Folders table
CREATE TABLE public.folders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'amber' CHECK (color IN ('amber', 'orange', 'emerald')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Videos table
CREATE TABLE public.videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  youtube_url TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  summary TEXT,
  notes TEXT[],
  duration TEXT,
  watched BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcards table
CREATE TABLE public.flashcards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  mastered BOOLEAN DEFAULT false,
  last_reviewed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Processing status table
CREATE TABLE public.video_processing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stage TEXT NOT NULL DEFAULT 'idle' CHECK (stage IN ('idle', 'extracting', 'generating', 'complete', 'error')),
  message TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_folders_user_id ON public.folders(user_id);
CREATE INDEX idx_videos_user_id ON public.videos(user_id);
CREATE INDEX idx_videos_folder_id ON public.videos(folder_id);
CREATE INDEX idx_flashcards_video_id ON public.flashcards(video_id);
CREATE INDEX idx_video_processing_video_id ON public.video_processing(video_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flashcards_updated_at BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

3. **Run the Script**
   - Paste the entire script
   - Click "Run"
   - You should see "Success. No rows returned" for each statement

### 2.2 Set Up Row Level Security (RLS)

1. **Create a new SQL query and run this RLS script:**

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_processing ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Folders policies
CREATE POLICY "Users can view own folders" ON public.folders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own folders" ON public.folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own folders" ON public.folders
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own folders" ON public.folders
  FOR DELETE USING (auth.uid() = user_id);

-- Videos policies
CREATE POLICY "Users can view own videos" ON public.videos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own videos" ON public.videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON public.videos
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON public.videos
  FOR DELETE USING (auth.uid() = user_id);

-- Flashcards policies
CREATE POLICY "Users can view flashcards for own videos" ON public.flashcards
  FOR SELECT USING (
    video_id IN (SELECT id FROM public.videos WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can create flashcards for own videos" ON public.flashcards
  FOR INSERT WITH CHECK (
    video_id IN (SELECT id FROM public.videos WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can update flashcards for own videos" ON public.flashcards
  FOR UPDATE USING (
    video_id IN (SELECT id FROM public.videos WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can delete flashcards for own videos" ON public.flashcards
  FOR DELETE USING (
    video_id IN (SELECT id FROM public.videos WHERE user_id = auth.uid())
  );

-- Video processing policies
CREATE POLICY "Users can view own processing status" ON public.video_processing
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own processing status" ON public.video_processing
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 2.3 Create Auth Trigger

1. **Create final SQL query for auto-profile creation:**

```sql
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Phase 3: Authentication Setup

### 3.1 Configure Google OAuth

1. **Go to Google Cloud Console**
   - Visit https://console.cloud.google.com
   - Create a new project or select existing one
   - Project name: "Recall App"

2. **Enable APIs**
   - Go to "APIs & Services" → "Enabled APIs & services"
   - Click "+ ENABLE APIS AND SERVICES"
   - Search for "Google+ API" and enable it
   - Search for "Generative Language API" and enable it

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Web application"
   - Name: "Recall App"
   - Add Authorized redirect URIs:
     ```
     https://your-project-id.supabase.co/auth/v1/callback
     ```
   - Click "Create"
   - **Save the Client ID and Client Secret**

4. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External"
   - Fill in required fields:
     - App name: "Recall"
     - User support email: your email
     - Developer contact: your email
   - Add scopes: email, profile, openid
   - Add test users (your email)

### 3.2 Configure Supabase Authentication

1. **In Supabase Dashboard**
   - Go to Authentication → Providers
   - Enable "Google" provider
   - Enter your Google OAuth credentials:
     - **Client ID**: from Google Console
     - **Client Secret**: from Google Console
   - Save configuration

2. **Configure Email Settings (Optional)**
   - Go to Authentication → Settings
   - Update email templates if desired
   - Set up custom SMTP if needed

---

## Phase 4: AI Provider Setup (Groq Primary, Google Optional)

Your app uses Groq as the primary free-tier LLM provider with optional Google AI fallback.

### 4.1 Get Groq API Key (Required)

Groq provides free-tier access with generous rate limits and no quota issues.

1. **Create Groq Account**
   - Visit https://console.groq.com
   - Click "Sign up"
   - Create account (Email recommended for stability)
   - Verify email

2. **Generate API Key**
   - In Groq console, go to "API Keys"
   - Click "Create API Key"
   - Name it "Recall App"
   - Copy the key and save it (you'll need it for Supabase secrets)

3. **Verify Access**
   - The free tier includes models:
     - `llama-3.1-8b-instant` (fast, 8B parameters)
     - `llama-3.3-70b-versatile` (powerful, 70B parameters)
   - No credit card required, generous rate limits

### 4.2 (Optional) Get Google AI Key as Fallback

If you want Google Gemini as a fallback when Groq is unavailable:

1. **In Google Cloud Console**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the API key
   - (Optional) Restrict the key to "Generative Language API"

---

## Phase 5: Environment Variables

### 5.1 Create Environment File

1. **In your project root, create `.env`:**

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Groq API Key (Primary LLM provider - required for video processing)
VITE_GROQ_API_KEY=your-groq-api-key-here

# Google AI API Key (Optional fallback - uncomment if you set it up)
# VITE_GOOGLE_AI_KEY=your-google-ai-key-here
```

2. **Replace the values:**
   - Groq API Key: from Groq console (https://console.groq.com)
   - Supabase credentials: from Supabase Settings → API
   - Google AI Key (optional): from Google Cloud Console → Credentials

### 5.2 Update .gitignore

Ensure your `.gitignore` includes:
```gitignore
.env
.env.local
.env.production
.env.development
```

---

## Phase 6: Deploy Edge Function

### 6.1 Install Supabase CLI

1. **Install CLI globally:**
```bash
npm install -g supabase
```

2. **Login to Supabase:**
```bash
supabase login
```

3. **Link your project:**
```bash
supabase link --project-ref your-project-ref-id
```
   - Find your project ref in Supabase Settings → General

### 6.2 Deploy the Function and Set Secrets

1. **Deploy the Edge Function:**
```bash
supabase functions deploy process-video
```

2. **Set Groq API Key (required):**
```bash
supabase secrets set GROQ_API_KEY=your-groq-api-key-here
```

3. **(Optional) Set Google AI as fallback:**
```bash
supabase secrets set GOOGLE_AI_KEY=your-google-ai-key-here
```

4. **(Optional) Force a specific Groq model:**
```bash
supabase secrets set GROQ_MODEL=llama-3.1-8b-instant
```
   Default is to try `llama-3.1-8b-instant` first, then `llama-3.3-70b-versatile`

### 6.3 Test Edge Function

1. **Test locally (optional):**
```bash
supabase functions serve process-video --no-verify-jwt
```

2. **Test deployed function:**
   - Go to Supabase Dashboard → Edge Functions
   - You should see "process-video" listed
   - Click on it to see logs and test

---

## Phase 7: Test the Application

### 7.1 Start Development Server

1. **Install dependencies:**
```bash
npm install
```

2. **Start the app:**
```bash
npm run dev
```

3. **Open browser to http://localhost:5173**

### 7.2 Test Features

1. **Test Authentication:**
   - Click "Sign Up" and create account with email
   - Try Google OAuth login
   - Verify profile is created in Supabase

2. **Test Folders:**
   - Create a new folder
   - Verify it appears in database (Supabase → Table Editor → folders)

3. **Test Video Processing:**
   - Add a YouTube URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)
   - Watch the processing status
   - Check if video, notes, and flashcards are created

4. **Test Flashcard Review:**
   - Go to Review section
   - Test marking cards as mastered/need review
   - Verify updates in database

---

## Troubleshooting

### Common Issues

1. **"Invalid API Key" Error:**
   - Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct
   - Restart development server after changing .env

2. **Google OAuth Not Working:**
   - Verify redirect URI in Google Console matches exactly
   - Check OAuth consent screen is configured
   - Ensure Google provider is enabled in Supabase

3. **Edge Function Errors / Video Processing Fails:**
   - Check Edge Function logs in Supabase Dashboard
   - Verify Groq API key is set: `supabase secrets list` (shows `GROQ_API_KEY`)
   - Ensure Groq has rate limit available (free tier is generous, but check console.groq.com)
   - (Fallback) If Groq fails, verify Google AI API key is set: `supabase secrets list`
   - Test with different YouTube URLs

4. **Database Permission Errors:**
   - Verify RLS policies are created correctly
   - Check that user is authenticated
   - Verify foreign key relationships

### Debugging Tips

1. **Check Browser Console** for JavaScript errors
2. **Check Supabase Logs** (Dashboard → Logs)
3. **Check Edge Function Logs** (Dashboard → Edge Functions → process-video)
4. **Verify Database Data** (Dashboard → Table Editor)
5. **Test Groq API directly** at https://console.groq.com/playground

---

## Production Deployment

### Additional Steps for Production

1. **Set up custom domain** (optional)
2. **Configure production environment variables**
3. **Set up monitoring and alerts**
4. **Configure backups**
5. **Set up SSL certificates**

### Environment Variables for Production

Create production `.env` file with:
- Production Supabase URL
- Production API keys
- Any analytics keys
- Error tracking keys (Sentry, etc.)

---

## Security Best Practices

1. **Never commit `.env` files**
2. **Use anon key for client, service key for server**
3. **Regularly rotate API keys**
4. **Monitor usage quotas**
5. **Set up proper OAuth scopes**

---

## Support Resources

- **Supabase Documentation**: https://supabase.com/docs
- **Google AI Documentation**: https://developers.generativeai.google/
- **React Query Documentation**: https://tanstack.com/query
- **YouTube Data API**: https://developers.google.com/youtube/v3

---

## Cost Estimates

### Free Tier Limits
- **Supabase**: 500MB database, 2GB bandwidth, 50K MAU
- **Google AI**: 60 RPM, 1M TPM free quota
- **Google Cloud**: $300 credit for new accounts

### Estimated Monthly Costs (paid tiers)
- **Supabase Pro**: $25/month (2GB database, 8GB bandwidth)
- **Google AI**: ~$0.50-5/month depending on usage
- **Google Cloud**: Minimal for OAuth ($0-10/month)

Total estimated cost: **$25-40/month** for moderate usage

---

## Next Steps

After successful setup:

1. **Customize the app** for your specific needs
2. **Add more video sources** (Vimeo, local files, etc.)
3. **Enhance AI prompts** for better content generation
4. **Add analytics and monitoring**
5. **Build mobile app** with React Native
6. **Add team collaboration features**

---

## Completion Checklist

- [ ] Supabase project created
- [ ] Database schema deployed
- [ ] RLS policies configured
- [ ] Google OAuth configured
- [ ] Environment variables set
- [ ] Edge Function deployed
- [ ] App running locally
- [ ] Authentication working
- [ ] Folder CRUD working
- [ ] Video processing working
- [ ] Flashcard review working

**Congratulations! Your Recall app is now fully integrated with Supabase! 🎉**