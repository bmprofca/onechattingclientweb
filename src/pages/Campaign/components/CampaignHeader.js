import React from 'react';
import { Users, Send, ChevronRight } from 'lucide-react';

export default function CampaignHeader({ activeTab }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Create Campaign
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Build and send your WhatsApp campaign in 2 simple steps</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
          <div className={`px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'audience' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
            <Users className="w-4 h-4" />
            <span className="font-medium text-sm sm:text-base">1. Audience</span>
          </div>
          <ChevronRight className="w-6 h-6 text-gray-300 self-center flex-shrink-0" />
          <div className={`px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'template' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
            <Send className="w-4 h-4" />
            <span className="font-medium text-sm sm:text-base">2. Template</span>
          </div>
        </div>
      </div>
    </div>
  );
}

