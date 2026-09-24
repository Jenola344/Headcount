'use client';

interface FilterTab {
  id: string;
  label: string;
  count: number;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function FilterTabs({ tabs, activeTab, onChange }: FilterTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#1E2030] pb-4">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all border ${
              isActive
                ? 'bg-white text-black border-white font-bold shadow-lg shadow-white/10'
                : 'bg-[#10111A] text-gray-400 border-[#202334] hover:border-gray-600 hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                isActive ? 'bg-black/10 text-black font-extrabold' : 'text-gray-500 font-mono'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
