"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  Filter,
  Calendar,
  DollarSign,
  MapPin,
  User,
  MessageCircle,
  MoreVertical,
  TrendingUp
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  type: "posted" | "accepted";
  status: "active" | "in-progress" | "completed" | "cancelled";
  budget?: string;
  timeline?: string;
  location: string;
  postedBy: {
    name: string;
    image: string;
  };
  assignedTo?: {
    name: string;
    image: string;
  };
  createdAt: string;
  tags: string[];
}

const mockTasks: Task[] = [
  {
    id: "1",
    title: "Fix Kitchen Sink Leak",
    description: "Need urgent plumbing service to fix a leaking kitchen sink. Water is dripping constantly.",
    type: "posted",
    status: "in-progress",
    budget: "$150-$200",
    timeline: "ASAP",
    location: "Manhattan, NY",
    postedBy: {
      name: "You",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
    },
    assignedTo: {
      name: "Sarah Johnson",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
    },
    createdAt: "2 hours ago",
    tags: ["Plumbing", "Urgent", "Residential"],
  },
  {
    id: "2",
    title: "Website Development for Local Business",
    description: "Looking for a web developer to create a modern, responsive website for my small business.",
    type: "accepted",
    status: "active",
    budget: "$1,500-$2,000",
    timeline: "2 weeks",
    location: "Brooklyn, NY",
    postedBy: {
      name: "Emily Rodriguez",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop",
    },
    assignedTo: {
      name: "You",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
    },
    createdAt: "1 day ago",
    tags: ["Web Development", "React", "Design"],
  },
  {
    id: "3",
    title: "House Deep Cleaning",
    description: "Need professional cleaning service for a 3-bedroom apartment before moving in.",
    type: "posted",
    status: "active",
    budget: "$300",
    timeline: "This weekend",
    location: "Queens, NY",
    postedBy: {
      name: "You",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
    },
    createdAt: "3 days ago",
    tags: ["Cleaning", "Residential"],
  },
  {
    id: "4",
    title: "Custom Furniture Repair",
    description: "Need to repair and restore antique wooden furniture. Requires experienced carpenter.",
    type: "accepted",
    status: "completed",
    budget: "$400",
    timeline: "1 week",
    location: "Manhattan, NY",
    postedBy: {
      name: "David Kumar",
      image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop",
    },
    assignedTo: {
      name: "You",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
    },
    createdAt: "2 weeks ago",
    tags: ["Carpentry", "Restoration"],
  },
];

export default function TasksPage() {
  const [selectedTab, setSelectedTab] = useState<"all" | "posted" | "accepted">("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const tabs = [
    { value: "all", label: "All Tasks", count: mockTasks.length },
    { value: "posted", label: "Posted by Me", count: mockTasks.filter(t => t.type === "posted").length },
    { value: "accepted", label: "Accepted by Me", count: mockTasks.filter(t => t.type === "accepted").length },
  ];

  const statusFilters = [
    { value: "all", label: "All Status", icon: Package },
    { value: "active", label: "Active", icon: Clock },
    { value: "in-progress", label: "In Progress", icon: TrendingUp },
    { value: "completed", label: "Completed", icon: CheckCircle2 },
  ];

  const filteredTasks = mockTasks.filter((task) => {
    const matchesTab = selectedTab === "all" || task.type === selectedTab;
    const matchesStatus = selectedStatus === "all" || task.status === selectedStatus;
    return matchesTab && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
      case "in-progress": return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
      case "completed": return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
      case "cancelled": return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
      default: return "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return Clock;
      case "in-progress": return TrendingUp;
      case "completed": return CheckCircle2;
      case "cancelled": return AlertCircle;
      default: return Package;
    }
  };

  const stats = [
    { label: "Total Tasks", value: mockTasks.length, icon: Package, color: "from-blue-500 to-indigo-600" },
    { label: "Active", value: mockTasks.filter(t => t.status === "active").length, icon: Clock, color: "from-yellow-500 to-orange-500" },
    { label: "In Progress", value: mockTasks.filter(t => t.status === "in-progress").length, icon: TrendingUp, color: "from-purple-500 to-pink-600" },
    { label: "Completed", value: mockTasks.filter(t => t.status === "completed").length, icon: CheckCircle2, color: "from-green-500 to-emerald-600" },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-3xl p-8 lg:p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,white,transparent_50%)] opacity-20"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold">My Tasks</h1>
              <p className="text-white/90">
                {/* Track jobs you've posted and accepted */}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold">{stat.label}</span>
                </div>
                <div className="text-3xl font-bold">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedTab(tab.value as any)}
              className={`flex-1 min-w-[150px] px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                selectedTab === tab.value
                  ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg scale-105"
                  : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Status Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Filter by Status
          </h2>
        </div>

        <div className="flex flex-wrap gap-3">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setSelectedStatus(filter.value)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                selectedStatus === filter.value
                  ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg scale-105"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              <filter.icon className="w-4 h-4" />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {filteredTasks.length} {filteredTasks.length === 1 ? "Task" : "Tasks"}
          </h2>
        </div>

        {filteredTasks.map((task) => {
          const StatusIcon = getStatusIcon(task.status);
          
          return (
            <div
              key={task.id}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 p-6 transition-all duration-300 hover:scale-[1.01]"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {task.title}
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {task.status.replace("-", " ").toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      task.type === "posted" 
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" 
                        : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                    }`}>
                      {task.type === "posted" ? "Posted by You" : "Accepted by You"}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    {task.description}
                  </p>
                </div>

                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {task.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                {task.budget && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Budget</div>
                      <div className="font-semibold text-slate-900 dark:text-white">{task.budget}</div>
                    </div>
                  </div>
                )}

                {task.timeline && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Timeline</div>
                      <div className="font-semibold text-slate-900 dark:text-white">{task.timeline}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Location</div>
                    <div className="font-semibold text-slate-900 dark:text-white">{task.location}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Posted</div>
                    <div className="font-semibold text-slate-900 dark:text-white">{task.createdAt}</div>
                  </div>
                </div>
              </div>

              {/* People Involved */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <img
                      src={task.postedBy.image}
                      alt={task.postedBy.name}
                      className="w-10 h-10 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700"
                    />
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Posted by</div>
                      <div className="font-semibold text-slate-900 dark:text-white">{task.postedBy.name}</div>
                    </div>
                  </div>

                  {task.assignedTo && (
                    <>
                      <div className="text-slate-300 dark:text-slate-600">→</div>
                      <div className="flex items-center gap-2">
                        <img
                          src={task.assignedTo.image}
                          alt={task.assignedTo.name}
                          className="w-10 h-10 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700"
                        />
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Assigned to</div>
                          <div className="font-semibold text-slate-900 dark:text-white">{task.assignedTo.name}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Chat
                  </button>
                  <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-all duration-200">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTasks.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
          <Package className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            No tasks found
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Try adjusting your filters or create a new task
          </p>
          <button className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl">
            Create New Task
          </button>
        </div>
      )}
    </div>
  );
}
