import { useEffect, useState } from 'react';
import { LayoutShell } from './components/LayoutShell';
import { HomeScreen } from './components/HomeScreen';
import { CreateScreen } from './components/CreateScreen';
import { StoryReviewScreen } from './components/StoryReviewScreen';
import { ProductionScreen } from './components/ProductionScreen';
import { VideoPreviewScreen } from './components/VideoPreviewScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { AssetTestWorkspace } from './components/AssetTestWorkspace';
import { buildLocalStructuredStory, generateStoryWithAI } from './engines/storyEngine';
import {
  clearTempSession,
  DEFAULT_STORY_INPUT,
  loadTempSession,
  saveTempSession,
} from './storage/sessionStore';
import type {
  AppRoute,
  RenderedVideoResult,
  StoryFormInput,
  StoryProject,
} from './types/story';

export default function App() {
  const [route, setRoute] = useState<AppRoute>('home');
  const [draftInput, setDraftInput] = useState<StoryFormInput>(DEFAULT_STORY_INPUT);
  const [story, setStory] = useState<StoryProject | null>(null);
  const [renderedVideo, setRenderedVideo] = useState<RenderedVideoResult | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore temporary browser session on mount if present
  useEffect(() => {
    loadTempSession()
      .then((saved) => {
        if (saved) {
          setDraftInput(saved.draftInput || DEFAULT_STORY_INPUT);
          setStory(saved.story || null);
          setRenderedVideo(saved.renderedVideo || null);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  // Persist active session temporarily in IndexedDB
  useEffect(() => {
    if (!hydrated) return;
    if (!story && !renderedVideo && !draftInput.prompt.trim()) return;
    void saveTempSession({
      draftInput,
      story,
      renderedVideo,
      activeRoute: route,
      updatedAt: Date.now(),
    });
  }, [hydrated, draftInput, story, renderedVideo, route]);

  // Warn before closing/reloading if active rendering or unsaved work exists
  useEffect(() => {
    const hasUnsavedWork = Boolean(
      route === 'production' || isGeneratingStory || story || renderedVideo
    );
    if (!hasUnsavedWork) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [route, isGeneratingStory, story, renderedVideo]);

  const handleNavigateTab = (tab: 'home' | 'create' | 'projects') => {
    if (tab === 'create') {
      // If a story is currently awaiting review or preview, still let Create open the active step or form cleanly
      if (story && !renderedVideo && route === 'create') {
        setRoute('review');
      } else {
        setRoute('create');
      }
      return;
    }
    setRoute(tab);
  };

  const handleGenerateAI = async (input: StoryFormInput) => {
    setDraftInput(input);
    setGenerationError(null);
    setIsGeneratingStory(true);
    try {
      const generated = await generateStoryWithAI(input);
      setStory(generated);
      setRenderedVideo(null);
      setRoute('review');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not reach the AI story service.';
      setGenerationError(message);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleGenerateLocalFallback = (input: StoryFormInput) => {
    setDraftInput(input);
    setGenerationError(null);
    const localStory = buildLocalStructuredStory(input);
    setStory(localStory);
    setRenderedVideo(null);
    setRoute('review');
  };

  const handleRegenerateStory = async () => {
    setGenerationError(null);
    setIsGeneratingStory(true);
    try {
      const generated = await generateStoryWithAI(draftInput);
      setStory(generated);
      setRenderedVideo(null);
    } catch {
      // If AI is unavailable during regeneration, rebuild via local engine only if current story is local
      if (story?.source === 'local-template') {
        setStory(buildLocalStructuredStory(draftInput));
        setRenderedVideo(null);
      } else {
        setRoute('create');
        setGenerationError('AI regeneration failed. You can retry or use the On-Device Story Builder.');
      }
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleApproveAndProduce = () => {
    if (!story) return;
    setStory({ ...story, approved: true });
    setRenderedVideo(null);
    setRoute('production');
  };

  const handleProductionComplete = (result: RenderedVideoResult) => {
    setRenderedVideo(result);
    setRoute('preview');
  };

  const handleClearAndStartNew = async () => {
    setStory(null);
    setRenderedVideo(null);
    setDraftInput(DEFAULT_STORY_INPUT);
    setGenerationError(null);
    await clearTempSession();
    setRoute('create');
  };

  const handleClearSessionToProjects = async () => {
    setStory(null);
    setRenderedVideo(null);
    setDraftInput(DEFAULT_STORY_INPUT);
    setGenerationError(null);
    await clearTempSession();
    setRoute('projects');
  };

  const handleResumeActive = () => {
    if (renderedVideo) {
      setRoute('preview');
    } else if (story) {
      setRoute('review');
    } else {
      setRoute('create');
    }
  };

  return (
    <LayoutShell
      activeRoute={route}
      onNavigate={handleNavigateTab}
      hasActiveSession={Boolean(story || renderedVideo)}
      hasRenderedVideo={Boolean(renderedVideo)}
      onResumeActive={handleResumeActive}
    >
      {route === 'home' && (
        <HomeScreen
          onStartCreate={() => setRoute('create')}
          activeStory={story}
          activeVideo={renderedVideo}
          onResumeSession={handleResumeActive}
          onOpenAssetLab={() => setRoute('asset_lab')}
        />
      )}

      {route === 'create' && (
        <CreateScreen
          initialInput={draftInput}
          isGenerating={isGeneratingStory}
          generationError={generationError}
          onGenerateAI={handleGenerateAI}
          onGenerateLocalFallback={handleGenerateLocalFallback}
        />
      )}

      {route === 'review' && story && (
        <StoryReviewScreen
          story={story}
          onUpdateStory={setStory}
          onBackToCreate={() => setRoute('create')}
          onRegenerate={handleRegenerateStory}
          onApproveAndProduce={handleApproveAndProduce}
          isRegenerating={isGeneratingStory}
        />
      )}

      {route === 'production' && story && (
        <ProductionScreen
          story={story}
          onComplete={handleProductionComplete}
          onBackToReview={() => setRoute('review')}
        />
      )}

      {route === 'preview' && renderedVideo && (
        <VideoPreviewScreen
          video={renderedVideo}
          onStartNewProject={handleClearAndStartNew}
          onReRender={() => setRoute('production')}
        />
      )}

      {route === 'projects' && (
        <ProjectsScreen
          story={story}
          video={renderedVideo}
          onCreateNew={() => setRoute('create')}
          onResumeStory={() => setRoute(story ? 'review' : 'create')}
          onOpenVideo={() => setRoute(renderedVideo ? 'preview' : 'create')}
          onClearSession={handleClearSessionToProjects}
        />
      )}

      {route === 'asset_lab' && (
        <AssetTestWorkspace onBackHome={() => setRoute('home')} />
      )}
    </LayoutShell>
  );
}
