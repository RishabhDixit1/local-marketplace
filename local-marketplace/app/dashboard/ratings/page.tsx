"use client";

import { useState } from "react";
import {
  Star,
  Award,
  TrendingUp,
  Users,
  MessageSquare,
  ThumbsUp,
  Shield,
  CheckCircle2,
  Calendar,
  Filter
} from "lucide-react";

interface Review {
  id: string;
  reviewerName: string;
  reviewerImage: string;
  providerName: string;
  providerImage: string;
  rating: number;
  service: string;
  comment: string;
  date: string;
  helpful: number;
  verified: boolean;
}

const mockReviews: Review[] = [
  {
    id: "1",
    reviewerName: "John Smith",
    reviewerImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
    providerName: "Sarah Johnson",
    providerImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
    rating: 5,
    service: "Plumbing Service",
    comment: "Excellent work! Sarah was professional, arrived on time, and fixed the issue quickly. Highly recommend her services.",
    date: "2 days ago",
    helpful: 12,
    verified: true,
  },
  {
    id: "2",
    reviewerName: "Emily Davis",
    reviewerImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop",
    providerName: "Michael Chen",
    providerImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
    rating: 5,
    service: "Web Development",
    comment: "Michael built an amazing website for my business. His attention to detail and communication throughout the project was outstanding.",
    date: "5 days ago",
    helpful: 8,
    verified: true,
  },
  {
    id: "3",
    reviewerName: "Robert Wilson",
    reviewerImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
    providerName: "Lisa Anderson",
    providerImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop",
    rating: 4,
    service: "House Cleaning",
    comment: "Great service overall. Lisa was thorough and professional. Only minor issue was running a bit late, but she made up for it with quality work.",
    date: "1 week ago",
    helpful: 5,
    verified: true,
  },
  {
    id: "4",
    reviewerName: "Maria Garcia",
    reviewerImage: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop",
    providerName: "David Kumar",
    providerImage: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop",
    rating: 5,
    service: "Carpentry",
    comment: "David built custom shelves for my home office. The craftsmanship is incredible and he stayed within budget. Will definitely hire again!",
    date: "2 weeks ago",
    helpful: 15,
    verified: true,
  },
];

const trustBadges = [
  { name: "Top Rated", icon: Star, color: "from-yellow-500 to-orange-500", count: 45 },
  { name: "Verified Pro", icon: Shield, color: "from-blue-500 to-indigo-600", count: 32 },
  { name: "Rising Star", icon: TrendingUp, color: "from-green-500 to-emerald-600", count: 28 },
  { name: "Community Hero", icon: Award, color: "from-purple-500 to-pink-600", count: 18 },
];

export default function RatingsPage() {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const filters = [
    { value: "all", label: "All Reviews", count: mockReviews.length },
    { value: "5-star", label: "5 Stars", count: mockReviews.filter(r => r.rating === 5).length },
    { value: "verified", label: "Verified Only", count: mockReviews.filter(r => r.verified).length },
  ];

  const filteredReviews = mockReviews.filter((review) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "5-star") return review.rating === 5;
    if (selectedFilter === "verified") return review.verified;
    return true;
  });

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 rounded-3xl p-8 lg:p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,white,transparent_50%)] opacity-20"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Star className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold">Ratings & Trust</h1>
              <p className="text-white/90">
                Build and maintain your reputation in the community
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5" />
                <span className="text-sm font-semibold">Avg Rating</span>
              </div>
              <div className="text-3xl font-bold">4.8</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-5 h-5" />
                <span className="text-sm font-semibold">Total Reviews</span>
              </div>
              <div className="text-3xl font-bold">523</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5" />
                <span className="text-sm font-semibold">Providers</span>
              </div>
              <div className="text-3xl font-bold">87</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-semibold">Verified</span>
              </div>
              <div className="text-3xl font-bold">95%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
          <Award className="w-7 h-7 text-indigo-600" />
          Trust Badges & Achievements
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {trustBadges.map((badge) => (
            <div
              key={badge.name}
              className="group relative overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${badge.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
              
              <div className="relative z-10">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${badge.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <badge.icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                  {badge.name}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {badge.count} providers earned this
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Filter className="w-6 h-6" />
            Filter Reviews
          </h2>
        </div>

        <div className="flex flex-wrap gap-3">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setSelectedFilter(filter.value)}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                selectedFilter === filter.value
                  ? "bg-gradient-to-r from-orange-500 to-pink-600 text-white shadow-lg scale-105"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Recent Reviews
          </h2>
          <span className="text-slate-600 dark:text-slate-400">
            {filteredReviews.length} {filteredReviews.length === 1 ? "review" : "reviews"}
          </span>
        </div>

        {filteredReviews.map((review) => (
          <div
            key={review.id}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 p-6 transition-all duration-300"
          >
            <div className="flex items-start gap-4">
              {/* Reviewer Info */}
              <div className="flex-shrink-0">
                <img
                  src={review.reviewerImage}
                  alt={review.reviewerName}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        {review.reviewerName}
                      </h3>
                      {review.verified && (
                        <div className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {review.date}
                    </p>
                  </div>
                  {renderStars(review.rating)}
                </div>

                {/* Service Info */}
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Service by
                  </span>
                  <div className="flex items-center gap-2">
                    <img
                      src={review.providerImage}
                      alt={review.providerName}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {review.providerName}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
                    {review.service}
                  </span>
                </div>

                {/* Comment */}
                <p className="text-slate-700 dark:text-slate-300 mb-4">
                  {review.comment}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <ThumbsUp className="w-4 h-4" />
                    Helpful ({review.helpful})
                  </button>
                  <button className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    Reply
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rating Distribution */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          Rating Distribution
        </h2>
        
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = mockReviews.filter(r => r.rating === stars).length;
            const percentage = (count / mockReviews.length) * 100;
            
            return (
              <div key={stars} className="flex items-center gap-4">
                <div className="flex items-center gap-1 w-20">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {stars}
                  </span>
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                </div>
                
                <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 w-16 text-right">
                  {count} ({percentage.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {filteredReviews.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
          <Star className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            No reviews found
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Try adjusting your filters
          </p>
        </div>
      )}
    </div>
  );
}