'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Site {
  id: string;
  appId: string;
  appName: string;
  appCategory: string;
  appStyle: string | null;
  appLogoUrl: string;
  appTagline: string;
  companyHqRegion: string;
  companyStage: string | null;
  platform: string;
  appVersionId: string;
  appVersionCreatedAt: string;
  appVersionUpdatedAt: string;
  appVersionPublishedAt: string;
  screenNumber: number;
  screenElements: string[];
  screenPatterns: string[];
  screenUrl: string;
  fullpageScreenUrl: string | null;
  pagePatterns: string[];
  pageType: string | null;
  pageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  allAppCategories: string[];
  screenKeywords: string;
  metadata: {
    width: number;
    height: number;
    boundingBoxes: any[];
  };
  popularityMetric: number;
  trendingMetric: number;
  '12_month_popularity_metric': number;
  uiElementsPopularityMetric: number;
  uiElementsTrendingMetric: number;
  ui_elements_12_month_popularity_metric: number;
}

interface SitesResponse {
  sites: Site[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  hasMore: boolean;
  filterCriteria: {
    filterOperator: string;
    appCategories: string[];
    screenElements: string[];
    screenPatterns: string[];
    isSubsequentRequest: boolean;
    pageIndex: number;
    pageSize: number;
    sortBy: string;
  };
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('popularity');
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const categories = [
    'Finance',
    'Shopping',
    'Entertainment',
    'Travel & Transportation',
    'Social Networking',
    'Crypto & Web3',
    'Real Estate',
    'Food & Drink'
  ];

  const fetchSites = async (isSubsequent = false) => {
    try {
      setLoading(true);
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterOperator: 'or',
          appCategories: selectedCategory ? [selectedCategory] : [],
          screenElements: [],
          screenPatterns: [],
          isSubsequentRequest: isSubsequent,
          pageIndex: isSubsequent ? pageIndex + 1 : 0,
          pageSize: 10,
          sortBy
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sites');
      }

      const data: SitesResponse = await response.json();
      
      if (isSubsequent) {
        setSites(prev => [...prev, ...data.sites]);
        setPageIndex(prev => prev + 1);
      } else {
        setSites(data.sites);
        setPageIndex(0);
      }
      
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [selectedCategory, sortBy]);

  const filteredSites = sites.filter(site =>
    site.appName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.appTagline.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.appCategory.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => fetchSites()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">App Screens</h1>
            <p className="mt-2 text-gray-600">Discover and analyze mobile app screens from top applications</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search apps..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="sm:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="sm:w-48">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="popularity">Popularity</option>
                <option value="trending">Trending</option>
                <option value="recent">Recent</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && sites.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="mb-6">
              <p className="text-gray-600">
                Showing {filteredSites.length} of {sites.length} results
              </p>
            </div>

            {/* Sites Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredSites.map((site) => (
                <div key={site.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200 overflow-hidden">
                  {/* App Logo and Info */}
                  <div className="p-4 border-b">
                    <div className="flex items-center space-x-3">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                        {site.appLogoUrl && (
                          <Image
                            src={site.appLogoUrl}
                            alt={site.appName}
                            fill
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {site.appName}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">
                          {site.appCategory}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {site.appTagline}
                    </p>
                  </div>

                  {/* Screen Image */}
                  <div className="relative aspect-[9/16] bg-gray-100">
                    {site.screenUrl && (
                      <Image
                        src={site.screenUrl}
                        alt={`${site.appName} screen`}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>

                  {/* Screen Details */}
                  <div className="p-4">
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                      <span>Screen #{site.screenNumber}</span>
                      <span>{formatDate(site.updatedAt)}</span>
                    </div>

                    {/* Screen Elements */}
                    <div className="mb-3">
                      <h4 className="text-xs font-medium text-gray-700 mb-1">UI Elements</h4>
                      <div className="flex flex-wrap gap-1">
                        {site.screenElements.slice(0, 3).map((element, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                          >
                            {element}
                          </span>
                        ))}
                        {site.screenElements.length > 3 && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                            +{site.screenElements.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Screen Patterns */}
                    <div className="mb-3">
                      <h4 className="text-xs font-medium text-gray-700 mb-1">Patterns</h4>
                      <div className="flex flex-wrap gap-1">
                        {site.screenPatterns.slice(0, 2).map((pattern, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full"
                          >
                            {pattern}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <span className="text-gray-500">
                          Popularity: {formatNumber(site.popularityMetric)}
                        </span>
                        <span className="text-gray-500">
                          Trending: {formatNumber(site.trendingMetric)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {site.platform.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => fetchSites(true)}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}

            {/* No Results */}
            {filteredSites.length === 0 && !loading && (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
