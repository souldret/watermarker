import Header from '@/components/Header';
import LogoPanel from '@/components/LogoPanel';
import Logo2Panel from '@/components/Logo2Panel';
import PositionGrid from '@/components/PositionGrid';
import SettingsSliders from '@/components/SettingsSliders';
import ModeTabs from '@/components/ModeTabs';
import FolderPicker from '@/components/FolderPicker';
import PreviewCanvas from '@/components/PreviewCanvas';
import InteractivePreview from '@/components/InteractivePreview';
import FileTree from '@/components/FileTree';
import ProgressPanel from '@/components/ProgressPanel';
import ActionBar from '@/components/ActionBar';
import PageFilterPanel from '@/components/PageFilterPanel';
import PresetPanel from '@/components/PresetPanel';
import AdvancedOptions from '@/components/AdvancedOptions';
import TemplatePackPanel from '@/components/TemplatePackPanel';
import SummaryCard from '@/components/SummaryCard';
import Wizard from '@/components/Wizard';
import { useI18n } from '@/hooks/useI18n';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

export default function Home() {
  const { t } = useI18n();
  const compact = useAppStore((s) => s.ui.compact);

  return (
    <div className={cn('app-shell relative min-h-screen text-ink-text', compact && 'compact-ui')}>
      <div className="bg-mesh pointer-events-none fixed inset-0 -z-10" />
      <div className="noise-overlay pointer-events-none fixed inset-0 -z-10" />

      <Header />
      <Wizard />

      <main
        className={cn(
          'mx-auto grid max-w-[1400px] gap-3 px-3 py-4 sm:px-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-4 lg:px-5 xl:grid-cols-[320px_minmax(0,1fr)]',
          compact && 'gap-2 py-3',
        )}
      >
        {/* Sol: kontroller — kaydırılabilir */}
        <aside
          className={cn(
            'flex flex-col gap-3 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pr-1 custom-scroll',
            compact && 'gap-2',
          )}
        >
          <LogoPanel />
          <Logo2Panel />
          <PositionGrid />
          <SettingsSliders />
          <AdvancedOptions />
          <PageFilterPanel />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <PresetPanel />
            <TemplatePackPanel />
          </div>
          <ModeTabs />
          <FolderPicker />
          <div className="sticky bottom-0 z-10 -mx-0.5 border-t border-ink-border/60 bg-ink-bg/90 p-1.5 backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <ActionBar />
          </div>
        </aside>

        {/* Sağ: büyük interaktif önizleme + kompakt + listeler */}
        <div className={cn('flex min-h-0 flex-col gap-3', compact && 'gap-2')}>
          <InteractivePreview />
          <div className="grid gap-3 md:grid-cols-[200px_minmax(0,1fr)]">
            <PreviewCanvas />
            <FileTree />
          </div>
          <SummaryCard />
          <ProgressPanel />
        </div>
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-6 pt-1 text-center text-[11px] text-ink-muted">
        {t('footer')}
      </footer>
    </div>
  );
}
