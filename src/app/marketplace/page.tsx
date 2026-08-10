"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Skeleton from "@/components/ui/skeleton";
import { InternshipCard, InternshipCardSkeleton } from "@/components/marketplace/internship-card";
import type { Internship } from "@/types";
import {
  Search,
  MapPin,
  Briefcase,
  DollarSign,
  Clock,
  Building2,
  Star,
  ArrowRight,
  TrendingUp,
  Filter,
  ChevronDown,
  X,
  Sparkles,
  Globe,
  Laptop,
  Calendar,
  Users,
  Heart,
  Grid3X3,
  List,
  SlidersHorizontal,
  RotateCcw,
  Zap,
  ChevronLeft,
  ChevronRight,
  Command,
} from "lucide-react";

// ============ MOCK DATA ============

const mockInternships: (Internship & {
  company_name: string;
  company_logo_url?: string;
  is_saved?: boolean;
  applicant_count?: number;
  rating?: number;
  review_count?: number;
})[] = [
  {
    id: "1",
    company_id: "c1",
    university_id: "u1",
    title: "Frontend Developer Intern",
    description: "Join our dynamic frontend team to build cutting-edge web experiences using React and Next.js. You'll work on real projects that impact thousands of users. Perfect opportunity to learn modern development practices and contribute to meaningful products that shape the future of education technology.",
    department_ids: ["d1"],
    program_ids: ["p1", "p2"],
    requirements: "Currently pursuing a degree in Computer Science or related field. Proficiency in HTML, CSS, JavaScript. Familiarity with React or similar frameworks. Understanding of responsive design principles.",
    responsibilities: "Develop and maintain frontend applications, implement pixel-perfect UI designs, optimize application performance, participate in code reviews, collaborate with designers and backend developers.",
    skills: ["React", "TypeScript", "Tailwind CSS", "Next.js", "Git"],
    location: "Islamabad",
    is_remote: false,
    is_paid: true,
    stipend: 25000,
    duration_weeks: 6,
    start_date: "2024-06-01",
    end_date: "2024-07-15",
    vacancies: 3,
    status: "published",
    created_by: "hr1",
    created_at: "2024-05-10T10:00:00Z",
    updated_at: "2024-05-10T10:00:00Z",
    company_name: "TechCorp Pakistan",
    company_logo_url: undefined,
    is_saved: false,
    applicant_count: 45,
    rating: 4.5,
    review_count: 12,
  },
  {
    id: "2",
    company_id: "c2",
    university_id: "u1",
    title: "Backend Engineer Intern",
    description: "Work with our backend team to design and implement robust APIs and microservices. Great opportunity for students passionate about server-side development, databases, and cloud infrastructure.",
    department_ids: ["d1", "d2"],
    program_ids: ["p3"],
    requirements: "Background in Computer Science. Experience with Python, Node.js, or Java. Understanding of RESTful APIs and database design. Knowledge of cloud platforms is a plus.",
    responsibilities: "Design and implement REST APIs, write clean and tested code, optimize database queries, work with cloud services (AWS/GCP), participate in architecture discussions.",
    skills: ["Node.js", "Python", "PostgreSQL", "AWS", "Docker"],
    location: null,
    is_remote: true,
    is_paid: true,
    stipend: 30000,
    duration_weeks: 8,
    start_date: "2024-05-15",
    end_date: "2024-07-10",
    vacancies: 2,
    status: "published",
    created_by: "hr2",
    created_at: "2024-05-09T14:30:00Z",
    updated_at: "2024-05-09T14:30:00Z",
    company_name: "Systems Ltd",
    company_logo_url: undefined,
    is_saved: true,
    applicant_count: 32,
    rating: 4.7,
    review_count: 18,
  },
  {
    id: "3",
    company_id: "c3",
    university_id: "u1",
    title: "Data Science Intern",
    description: "Join our data team to analyze large datasets, build machine learning models, and derive actionable insights. Perfect for students passionate about AI/ML and data analytics.",
    department_ids: ["d1"],
    program_ids: ["p1", "p4"],
    requirements: "Pursuing degree in CS, Statistics, or related field. Experience with Python, pandas, scikit-learn. Knowledge of SQL and data visualization tools. Strong analytical thinking.",
    responsibilities: "Clean and preprocess datasets, develop ML models, create visualizations and dashboards, present findings to stakeholders, document methodologies and results.",
    skills: ["Python", "Machine Learning", "TensorFlow", "SQL", "Tableau"],
    location: "Lahore",
    is_remote: false,
    is_paid: true,
    stipend: 40000,
    duration_weeks: 12,
    start_date: "2024-06-01",
    end_date: "2024-08-24",
    vacancies: 5,
    status: "published",
    created_by: "hr3",
    created_at: "2024-05-08T09:00:00Z",
    updated_at: "2024-05-08T09:00:00Z",
    company_name: "NetSol Technologies",
    company_logo_url: undefined,
    is_saved: false,
    applicant_count: 18,
    rating: 4.8,
    review_count: 24,
  },
  {
    id: "4",
    company_id: "c4",
    university_id: "u1",
    title: "Mobile App Developer Intern",
    description: "Help us create amazing mobile experiences for iOS and Android platforms. Work with modern frameworks like React Native and Flutter to build apps used by millions.",
    department_ids: ["d1"],
    program_ids: ["p5"],
    requirements: "Understanding of mobile development fundamentals. Experience with React Native, Flutter, or native iOS/Android development. Portfolio of mobile projects preferred.",
    responsibilities: "Build cross-platform mobile features, implement beautiful UI components, optimize app performance, ensure code quality through testing, collaborate with product team.",
    skills: ["React Native", "Flutter", "TypeScript", "Firebase", "REST APIs"],
    location: "Karachi",
    is_remote: false,
    is_paid: true,
    stipend: 28000,
    duration_weeks: 8,
    start_date: "2024-06-15",
    end_date: "2024-08-10",
    vacancies: 4,
    status: "published",
    created_by: "hr4",
    created_at: "2024-05-07T11:45:00Z",
    updated_at: "2024-05-07T11:45:00Z",
    company_name: "AppWorks Studio",
    company_logo_url: undefined,
    is_saved: false,
    applicant_count: 56,
    rating: 4.3,
    review_count: 9,
  },
  {
    id: "5",
    company_id: "c5",
    university_id: "u1",
    title: "UI/UX Design Intern",
    description: "Learn what it takes to create intuitive user experiences by working alongside our design team. Gain hands-on experience in user research, wireframing, and prototyping.",
    department_ids: ["d2", "d3"],
    program_ids: ["p6", "p7"],
    requirements: "Strong visual design skills. Proficiency in Figma or Adobe Creative Suite. Understanding of design principles and user-centered design process. Portfolio required.",
    responsibilities: "Create user flows and wireframes, design high-fidelity mockups, conduct usability testing, maintain design systems, collaborate with developers on implementation.",
    skills: ["Figma", "Adobe XD", "User Research", "Prototyping", "Design Systems"],
    location: "Islamabad",
    is_remote: true,
    is_paid: true,
    stipend: 22000,
    duration_weeks: 6,
    start_date: "2024-06-01",
    end_date: "2024-07-13",
    vacancies: 2,
    status: "published",
    created_by: "hr5",
    created_at: "2024-05-06T16:20:00Z",
    updated_at: "2024-05-06T16:20:00Z",
    company_name: "DesignHub Agency",
    company_logo_url: undefined,
    is_saved: true,
    applicant_count: 29,
    rating: 4.6,
    review_count: 15,
  },
  {
    id: "6",
    company_id: "c6",
    university_id: "u1",
    title: "Digital Marketing Intern",
    description: "Gain valuable marketing experience at a growing tech company. Learn digital marketing strategies, content creation, social media management, and performance analytics.",
    department_ids: ["d3"],
    program_ids: ["p7", "p8"],
    requirements: "Creative mindset with strong writing skills. Familiarity with social media platforms and digital marketing tools. Marketing coursework or previous experience a plus but not required.",
    responsibilities: "Create social media content, assist with email campaigns, conduct competitor analysis, support event planning, track campaign metrics and prepare reports.",
    skills: ["Social Media", "Content Writing", "Google Analytics", "SEO", "Canva"],
    location: "Lahore",
    is_remote: false,
    is_paid: false,
    stipend: undefined,
    duration_weeks: 8,
    start_date: "2024-07-01",
    end_date: "2024-08-26",
    vacancies: 6,
    status: "published",
    created_by: "hr6",
    created_at: "2024-05-05T13:00:00Z",
    updated_at: "2024-05-05T13:00:00Z",
    company_name: "GrowthStart Co.",
    company_logo_url: undefined,
    is_saved: false,
    applicant_count: 67,
    rating: 4.1,
    review_count: 8,
  },
  {
    id: "7",
    company_id: "c7",
    university_id: "u1",
    title: "DevOps Engineer Intern",
    description: "Get hands-on experience with cloud infrastructure, CI/CD pipelines, and containerization technologies. Work on automating deployment processes and maintaining production systems.",
    department_ids: ["d1"],
    program_ids: ["p1", "p2"],
    requirements: "Basic knowledge of Linux and networking concepts. Familiarity with cloud platforms (AWS/GCP/Azure). Scripting ability in Bash or Python. Eagerness to learn DevOps practices.",
    responsibilities: "Manage CI/CD pipelines, configure cloud infrastructure, monitor system health, automate repetitive tasks, maintain documentation, assist with incident response.",
    skills: ["AWS", "Docker", "Kubernetes", "Terraform", "Bash"],
    location: null,
    is_remote: true,
    is_paid: true,
    stipend: 35000,
    duration_weeks: 12,
    start_date: "2024-06-15",
    end_date: "2024-09-07",
    vacancies: 2,
    status: "published",
    created_by: "hr7",
    created_at: "2024-05-04T10:30:00Z",
    updated_at: "2024-05-04T10:30:00Z",
    company_name: "CloudTech Solutions",
    company_logo_url: undefined,
    is_saved: false,
    applicant_count: 14,
    rating: 4.9,
    review_count: 21,
  },
  {
    id: "8",
    company_id: "c8",
    university_id: "u1",
    title: "Product Management Intern",
    description: "Learn what it takes to build great products by working alongside our product team. Gain experience in market research, roadmap planning, feature prioritization, and stakeholder communication.",
    department_ids: ["d2", "d3"],
    program_ids: ["p9"],
    requirements: "Strong communication and analytical skills. Interest in technology products. Experience with data analysis tools. Business or technical background welcome. Problem-solving mindset essential.",
    responsibilities: "Conduct market research, analyze user feedback, create product requirements documents, coordinate with engineering teams, track key metrics, prepare presentations.",
    skills: ["Product Strategy", "Data Analysis", "Agile", "Jira", "Communication"],
    location: "Rawalpindi",
    is_remote: false,
    is_paid: true,
    stipend: 20000,
    duration_weeks: 6,
    start_date: "2024-06-01",
    end_date: "2024-07-13",
    vacancies: 1,
    status: "published",
    created_by: "hr8",
    created_at: "2024-05-03T15:00:00Z",
    updated_at: "2024-05-03T15:00:00Z",
    company_name: "InnovateTech LLC",
    company_logo_url: undefined,
    is_saved: false,
    applicant_count: 41,
    rating: 4.4,
    review_count: 11,
  },
  {
    id: "9",
    company_id: "c9",
    university_id: "u1",
    title: "Cybersecurity Analyst Intern",
    description: "Join our security operations center to help protect organizational assets. Learn about threat detection, vulnerability assessment, and incident response in a real-world environment.",
    department_ids: ["d1"],
    program_ids: ["p5"],
    requirements: "Understanding of network security concepts. Knowledge of common attack vectors. Certifications like Security+ or CEH a plus. Strong analytical and problem-solving skills.",
    responsibilities: "Monitor security systems, analyze potential threats, assist with penetration testing, document security procedures, stay current on threat landscape.",
    skills: ["Network Security", "Penetration Testing", "SIEM", "Linux", "Python"],
    location: "Islamabad",
    is_remote: false,
    is_paid: true,
    stipend: 32000,
    duration_weeks: 10,
    start_date: "2024-06-01",
    end_date: "2024-08-10",
    vacancies: 2,
    status: "published",
    created_by: "hr9",
    created_at: "2024-05-02T11:45:00Z",
    updated_at: "2024-05-02T11:45:00Z",
    company_name: "SecureNet Solutions",
    company_logo_url: undefined,
    is_saved: false,
    applicant_count: 23,
    rating: 4.7,
    review_count: 16,
  },
  {
    id: "10",
    company_id: "c10",
    university_id: "u1",
    title: "Quality Assurance Intern",
    description: "Ensure the quality of our software products through comprehensive testing. Learn manual and automated testing methodologies while working on real products.",
    department_ids: ["d1"],
    program_ids: ["p1", "p2"],
    requirements: "Attention to detail and quality-focused mindset. Basic understanding of software testing concepts. Familiarity with bug tracking tools. Willingness to learn automation tools.",
    responsibilities: "Write and execute test cases, report and track bugs, perform regression testing, collaborate with developers on fixes, contribute to test documentation.",
    skills: ["Manual Testing", "Selenium", "JIRA", "API Testing", "SQL"],
    location: "Karachi",
    is_remote: true,
    is_paid: true,
    stipend: 18000,
    duration_weeks: 8,
    start_date: "2024-06-15",
    end_date: "2024-08-10",
    vacancies: 4,
    status: "published",
    created_by: "hr10",
    created_at: "2024-05-01T09:00:00Z",
    updated_at: "2024-05-01T09:00:00Z",
    company_name: "QA Experts Inc",
    company_logo_url: undefined,
    is_saved: false,
    applicant_count: 38,
    rating: 4.2,
    review_count: 14,
  },
  {
    id: "11",
    company_id: "c11",
    university_id: "u1",
    title: "Full Stack Developer Intern",
    description: "End-to-end development opportunity where you'll work on both frontend and backend. Build complete features from database to user interface in an agile environment.",
    department_ids: ["d1"],
    program_ids: ["p1"],
    requirements: "Proficiency in JavaScript/TypeScript. Experience with React and Node.js. Understanding of database design. Ability to work independently and in teams.",
    responsibilities: "Build full-stack features, design database schemas, create RESTful APIs, implement responsive UIs, write unit and integration tests, participate in code reviews.",
    skills: ["React", "Node.js", "MongoDB", "Express", "TypeScript"],
    location: "Lahore",
    is_remote: false,
    is_paid: true,
    stipend: 28000,
    duration_weeks: 12,
    start_date: "2024-06-01",
    end_date: "2024-08-24",
    vacancies: 3,
    status: "published",
    created_by: "hr11",
    created_at: "2024-04-30T14:00:00Z",
    updated_at: "2024-04-30T14:00:00Z",
    company_name: "Stack Builders",
    company_logo_url: undefined,
    is_saved: true,
    applicant_count: 52,
    rating: 4.5,
    review_count: 19,
  },
  {
    id: "12",
    company_id: "c12",
    university_id: "u1",
    title: "Business Analyst Intern",
    description: "Bridge the gap between business needs and technical solutions. Learn to gather requirements, analyze processes, and present recommendations to stakeholders.",
    department_ids: ["d3"],
    program_ids: ["p6", "p7"],
    requirements: "Strong analytical and communication skills. Interest in business process improvement. Proficiency in Excel and presentation tools. Detail-oriented approach.",
    responsibilities: "Gather and document requirements, analyze business processes, create process flow diagrams, prepare reports and presentations, facilitate stakeholder meetings.",
    skills: ["Requirements Analysis", "SQL", "Excel", "Process Mapping", "Visio"],
    location: "Islamabad",
    is_remote: false,
    is_paid: true,
    stipend: 22000,
    duration_weeks: 8,
    start_date: "2024-07-01",
    end_date: "2024-08-26",
    vacancies: 2,
    status: "published",
    created_by: "hr12",
    created_at: "2024-04-29T11:00:00Z",
    updated_at: "2024-04-29T11:00:00Z",
    company_name: "ConsultPro Group",
    company_logo_url: undefined,
    is_saved: false,
    applicant_count: 33,
    rating: 4.3,
    review_count: 10,
  },
];

// Filter options
const filterOptions = {
  locations: [
    { id: "remote", label: "Remote", count: 23 },
    { id: "islamabad", label: "Islamabad", count: 45 },
    { id: "lahore", label: "Lahore", count: 38 },
    { id: "karachi", label: "Karachi", count: 29 },
    { id: "rawalpindi", label: "Rawalpindi", count: 21 },
  ],
  types: [
    { id: "full-time", label: "Full-time", count: 89 },
    { id: "part-time", label: "Part-time", count: 42 },
    { id: "remote", label: "Remote", count: 25 },
  ],
  durations: [
    { id: "4", label: "4 weeks", count: 28 },
    { id: "6", label: "6 weeks", count: 67 },
    { id: "8", label: "8 weeks", count: 45 },
    { id: "12", label: "12 weeks", count: 44 },
  ],
  stipends: [
    { id: "paid", label: "Paid", count: 120 },
    { id: "unpaid", label: "Unpaid", count: 36 },
  ],
  industries: [
    { id: "software", label: "Software & IT", count: 56 },
    { id: "finance", label: "Finance & Banking", count: 28 },
    { id: "marketing", label: "Marketing & Media", count: 24 },
    { id: "engineering", label: "Engineering", count: 32 },
    { id: "design", label: "Design & Creative", count: 18 },
  ],
};

const quickFilterOptions = [
  { id: "tech", label: "Tech", icon: <Laptop className="h-4 w-4" /> },
  { id: "data", label: "Data", icon: <span className="text-lg">📊</span> },
  { id: "design", label: "Design", icon: <span className="text-lg">🎨</span> },
  { id: "marketing", label: "Marketing", icon: <Briefcase className="h-4 w-4" /> },
];

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};

// ============ TYPES ============
interface Filters {
  search: string;
  locations: string[];
  types: string[];
  durations: string[];
  stipends: string[];
  industries: string[];
  sortBy: string;
}

const defaultFilters: Filters = {
  search: "",
  locations: [],
  types: [],
  durations: [],
  stipends: [],
  industries: [],
  sortBy: "relevance",
};

// ============ MAIN COMPONENT ============
export default function MarketplacePage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [savedInternships, setSavedInternships] = useState<Set<string>>(
    new Set(mockInternships.filter(i => i.is_saved).map(i => i.id))
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const itemsPerPage = viewMode === "grid" ? 9 : 8;

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearchModal(true);
      }
      if (e.key === "Escape") {
        setShowSearchModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter and sort internships
  const filteredInternships = useMemo(() => {
    let result = [...mockInternships];

    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(
        (internship) =>
          internship.title.toLowerCase().includes(query) ||
          internship.company_name.toLowerCase().includes(query) ||
          internship.description.toLowerCase().includes(query) ||
          internship.skills?.some((skill) => skill.toLowerCase().includes(query))
      );
    }

    // Location filter
    if (filters.locations.length > 0) {
      result = result.filter((internship) => {
        if (filters.locations.includes("remote") && internship.is_remote) return true;
        return filters.locations.some(loc => 
          internship.location?.toLowerCase().includes(loc.toLowerCase())
        );
      });
    }

    // Stipend filter
    if (filters.stipends.includes("paid")) {
      result = result.filter(internship => internship.is_paid);
    }
    if (filters.stipends.includes("unpaid")) {
      result = result.filter(internship => !internship.is_paid);
    }

    // Duration filter
    if (filters.durations.length > 0) {
      result = result.filter(internship =>
        filters.durations.some(d => String(internship.duration_weeks) === d)
      );
    }

    // Sort
    switch (filters.sortBy) {
      case "recent":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "deadline":
        result.sort((a, b) => new Date(a.end_date || "").getTime() - new Date(b.end_date || "").getTime());
        break;
      case "applicants":
        result.sort((a, b) => (b.applicant_count || 0) - (a.applicant_count || 0));
        break;
      case "stipend":
        result.sort((a, b) => (b.stipend || 0) - (a.stipend || 0));
        break;
      default:
        break;
    }

    return result;
  }, [filters]);

  // Pagination
  const totalPages = Math.ceil(filteredInternships.length / itemsPerPage);
  const paginatedInternships = filteredInternships.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleApply = useCallback((id: string) => {
    console.log("Applying for internship:", id);
    alert("Please log in to apply for this internship.");
  }, []);

  const handleSave = useCallback((id: string) => {
    setSavedInternships((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const updateFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const toggleArrayFilter = useCallback((key: keyof Pick<Filters, "locations" | "types" | "durations" | "stipends" | "industries">, value: string) => {
    setFilters(prev => {
      const current = prev[key] as string[];
      const newArray = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: newArray };
    });
    setCurrentPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = 
    filters.search ||
    filters.locations.length > 0 ||
    filters.types.length > 0 ||
    filters.durations.length > 0 ||
    filters.stipends.length > 0 ||
    filters.industries.length > 0;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ============ HERO / SEARCH SECTION ============ */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/3 overflow-hidden w-full">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-16 lg:py-20 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-6"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Badge variant="secondary" className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors">
                <Sparkles className="h-4 w-4 mr-2" />
                Find Your Perfect Internship
              </Badge>
            </motion.div>

            {/* Main heading */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-tight">
              Discover{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Opportunities
              </span>
              <br />
              That Shape Your Future
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
              Explore {mockInternships.length}+ active internships from top companies. 
              Launch your career with hands-on experience that matters.
            </p>

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-3xl mx-auto w-full px-0 sm:px-0"
            >
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="search"
                  placeholder="Search internships..."
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                  className="pl-12 pr-20 sm:pr-[140px] h-11 sm:h-12 md:h-14 text-sm sm:text-base rounded-xl sm:rounded-2xl border-2 shadow-lg shadow-black/5 focus-visible:ring-primary/20 focus-visible:border-primary/50 bg-white/80 backdrop-blur-sm w-full min-w-0"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                  <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-muted border rounded-md">
                    <Command className="h-3 w-3" />
                    K
                  </kbd>
                  
                  {/* Mobile Filter Trigger */}
                  <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl lg:hidden">
                        <SlidersHorizontal className="h-4 w-4" />
                        {hasActiveFilters && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                            !
                          </span>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                          <Filter className="h-5 w-5" />
                          Filters
                        </SheetTitle>
                      </SheetHeader>
                      <FilterSidebar 
                        filters={filters}
                        onToggleFilter={toggleArrayFilter}
                        onUpdateFilter={updateFilter}
                        onClearAll={clearAllFilters}
                      />
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-4 sm:mt-5 max-w-full">
                {quickFilterOptions.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-4 hover:bg-primary/10 hover:border-primary/30 transition-all whitespace-nowrap"
                  >
                    {option.icon}
                    {option.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-4 text-muted-foreground hover:text-foreground whitespace-nowrap"
                >
                  All Categories
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-3 sm:gap-4 sm:gap-6 lg:gap-8 pt-6 sm:pt-8 w-full max-w-full"
            >
              {[
                { value: `${mockInternships.length}`, label: "Active Internships", icon: Briefcase },
                { value: "45", label: "Companies", icon: Building2 },
                { value: "12", label: "Universities", icon: Star },
                { value: "95%", label: "Satisfaction Rate", icon: TrendingUp },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-1.5 sm:gap-2 sm:gap-3 px-2 sm:px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/50 backdrop-blur-sm border border-border/50 justify-center sm:justify-start min-w-0">
                  <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold leading-none">{stat.value}</p>
                    <p className="text-[9px] sm:text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ============ MAIN CONTENT AREA ============ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full overflow-x-hidden">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* ============ FILTER SIDEBAR (Desktop) ============ */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  Filters
                </h2>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>

              <FilterSidebar 
                filters={filters}
                onToggleFilter={toggleArrayFilter}
                onUpdateFilter={updateFilter}
                onClearAll={clearAllFilters}
              />
            </div>
          </aside>

          {/* ============ LISTINGS AREA ============ */}
          <div className="flex-1 min-w-0 w-full space-y-4 sm:space-y-6 overflow-x-hidden">
            {/* Results Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-semibold truncate">
                  Found{" "}
                  <span className="text-primary">{filteredInternships.length}</span>{" "}
                  internships
                </p>
                <p className="text-sm text-muted-foreground">
                  {filteredInternships.length > 0 && `Page ${currentPage} of ${totalPages}`}
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* View Toggle */}
                <div className="hidden sm:flex items-center border rounded-lg p-1">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                {/* Sort Dropdown */}
                <Select value={filters.sortBy} onValueChange={(v) => updateFilter("sortBy", v)}>
                  <SelectTrigger className="w-[130px] sm:w-[150px] md:w-[180px] h-9 sm:h-10 rounded-xl text-sm">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="deadline">Deadline Soon</SelectItem>
                    <SelectItem value="applicants">Most Applicants</SelectItem>
                    <SelectItem value="stipend">Highest Stipend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Filters Pills */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-muted/50 rounded-xl min-w-0">
                <span className="text-sm text-muted-foreground mr-1">Active:</span>
                
                {filters.search && (
                  <Badge variant="secondary" className="gap-1 text-xs max-w-[180px] sm:max-w-none truncate">
                    Search: {filters.search}
                    <button onClick={() => updateFilter("search", "")} className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                
                {filters.locations.map(loc => (
                  <Badge key={loc} variant="secondary" className="gap-1 capitalize text-xs">
                    {loc}
                    <button onClick={() => toggleArrayFilter("locations", loc)} className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                
                {filters.stipends.map(s => (
                  <Badge key={s} variant="secondary" className="gap-1 capitalize text-xs">
                    {s}
                    <button onClick={() => toggleArrayFilter("stipends", s)} className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}

                {filters.durations.map(d => (
                  <Badge key={d} variant="secondary" className="gap-1 text-xs">
                    {d} weeks
                    <button onClick={() => toggleArrayFilter("durations", d)} className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-6 text-xs ml-auto"
                >
                  Clear all
                </Button>
              </div>
            )}

            {/* Loading State */}
            {isLoading ? (
              <div className={`grid gap-4 sm:gap-6 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
                {[...Array(itemsPerPage)].map((_, i) => (
                  <InternshipCardSkeleton key={i} viewMode={viewMode} />
                ))}
              </div>
            ) : (
              <>
                {/* Internships Grid/List */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${viewMode}-${currentPage}-${filters.sortBy}`}
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0 }}
                    className={`grid gap-4 sm:gap-6 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}
                  >
                    {paginatedInternships.map((internship) => (
                      <motion.div key={internship.id} variants={fadeInUp}>
                        <InternshipCard
                          internship={{
                            ...internship,
                            is_saved: savedInternships.has(internship.id),
                          }}
                          onApply={handleApply}
                          onSave={handleSave}
                          viewMode={viewMode}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* Empty State */}
                {filteredInternships.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16"
                  >
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <Search className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-2xl font-semibold mb-2">No internships found</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Try adjusting your search terms or filters to find more opportunities that match your interests.
                    </p>
                    <Button onClick={clearAllFilters} variant="outline" className="rounded-xl">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Clear All Filters
                    </Button>
                  </motion.div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 sm:gap-2 pt-6 sm:pt-8 overflow-x-auto pb-2 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => 
                        page === 1 || 
                        page === totalPages || 
                        Math.abs(page - currentPage) <= 1
                      )
                      .map((page, idx, arr) => (
                        <React.Fragment key={page}>
                          {idx > 0 && page - arr[idx - 1] > 1 && (
                            <span className="text-muted-foreground px-0.5 sm:px-1 shrink-0">...</span>
                          )}
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="icon"
                            onClick={() => setCurrentPage(page)}
                            className={`rounded-xl h-9 w-9 sm:h-10 sm:w-10 shrink-0 ${
                              currentPage === page ? "shadow-lg shadow-primary/25" : ""
                            }`}
                          >
                            {page}
                          </Button>
                        </React.Fragment>
                      ))}
                    
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-xl h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* ============ SEARCH MODAL (⌘K) ============ */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] bg-black/50 backdrop-blur-sm px-2 sm:px-4" onClick={() => setShowSearchModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl mx-2 sm:mx-4 bg-background rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-3 sm:p-4 border-b">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search internships..."
                autoFocus
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="flex-1 outline-none text-base sm:text-lg bg-transparent min-w-0"
              />
              <kbd className="hidden xs:inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-muted border rounded-md">
                ESC
              </kbd>
            </div>
            
            <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto p-2">
              {filters.search ? (
                filteredInternships.slice(0, 8).map((internship) => (
                  <Link
                    key={internship.id}
                    href={`/marketplace/${internship.id}`}
                    className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-muted transition-colors"
                    onClick={() => setShowSearchModal(false)}
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">{internship.title}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{internship.company_name}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                  </Link>
                ))
              ) : (
                <div className="p-6 sm:p-8 text-center text-muted-foreground">
                  <p className="text-sm sm:text-base">Type to search internships...</p>
                </div>
              )}
              
              {filters.search && filteredInternships.length === 0 && (
                <div className="p-6 sm:p-8 text-center text-muted-foreground">
                  <p className="text-sm sm:text-base">No results found for "{filters.search}"</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ============ CTA SECTION ============ */}
      <section className="bg-gradient-to-br from-primary/5 via-primary/10 to-background py-10 sm:py-12 md:py-16 mt-8 sm:mt-12 w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-3 sm:space-y-4"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight px-2">
              Ready to Find Your{" "}
              <span className="text-primary">Dream Internship</span>?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              Create an account to save internships, track applications, and get personalized recommendations based on your profile.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-3 sm:pt-4">
              <Button size="lg" className="rounded-xl px-6 sm:px-8 shadow-lg shadow-primary/25 text-sm sm:text-base" asChild>
                <Link href="/register">
                  Get Started Free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-xl px-6 sm:px-8 text-sm sm:text-base" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t py-6 sm:py-8 px-4 sm:px-6 lg:px-8 bg-muted/30 w-full">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Briefcase className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-base sm:text-lg">InternHub Marketplace</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6 text-xs sm:text-sm text-muted-foreground max-w-full">
              <a href="#" className="hover:text-foreground transition-colors whitespace-nowrap">About</a>
              <a href="#" className="hover:text-foreground transition-colors whitespace-nowrap">For Employers</a>
              <a href="#" className="hover:text-foreground transition-colors whitespace-nowrap">For Universities</a>
              <a href="#" className="hover:text-foreground transition-colors whitespace-nowrap">Contact</a>
              <a href="#" className="hover:text-foreground transition-colors whitespace-nowrap">Privacy Policy</a>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground shrink-0">
              © {new Date().getFullYear()} InternHub. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============ FILTER SIDEBAR COMPONENT ============
function FilterSidebar({
  filters,
  onToggleFilter,
  onUpdateFilter,
  onClearAll,
}: {
  filters: Filters;
  onToggleFilter: (key: keyof Pick<Filters, "locations" | "types" | "durations" | "stipends" | "industries">, value: string) => void;
  onUpdateFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Location Filter */}
      <FilterGroup title="Location" icon={<MapPin className="h-4 w-4" />}>
        {filterOptions.locations.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-3 cursor-pointer group/item py-1.5"
          >
            <Checkbox
              checked={filters.locations.includes(option.id)}
              onCheckedChange={() => onToggleFilter("locations", option.id)}
              className="rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="flex-1 text-sm group-hover/item:text-foreground transition-colors">
              {option.label}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {option.count}
            </span>
          </label>
        ))}
      </FilterGroup>

      <Separator />

      {/* Type Filter */}
      <FilterGroup title="Type" icon={<Briefcase className="h-4 w-4" />}>
        {filterOptions.types.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-3 cursor-pointer group/item py-1.5"
          >
            <Checkbox
              checked={filters.types.includes(option.id)}
              onCheckedChange={() => onToggleFilter("types", option.id)}
              className="rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="flex-1 text-sm group-hover/item:text-foreground transition-colors">
              {option.label}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {option.count}
            </span>
          </label>
        ))}
      </FilterGroup>

      <Separator />

      {/* Duration Filter */}
      <FilterGroup title="Duration" icon={<Clock className="h-4 w-4" />}>
        {filterOptions.durations.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-3 cursor-pointer group/item py-1.5"
          >
            <Checkbox
              checked={filters.durations.includes(option.id)}
              onCheckedChange={() => onToggleFilter("durations", option.id)}
              className="rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="flex-1 text-sm group-hover/item:text-foreground transition-colors">
              {option.label}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {option.count}
            </span>
          </label>
        ))}
      </FilterGroup>

      <Separator />

      {/* Stipend Filter */}
      <FilterGroup title="Stipend" icon={<DollarSign className="h-4 w-4" />}>
        {filterOptions.stipends.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-3 cursor-pointer group/item py-1.5"
          >
            <Checkbox
              checked={filters.stipends.includes(option.id)}
              onCheckedChange={() => onToggleFilter("stipends", option.id)}
              className="rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="flex-1 text-sm group-hover/item:text-foreground transition-colors">
              {option.label}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {option.count}
            </span>
          </label>
        ))}
      </FilterGroup>

      <Separator />

      {/* Industry Filter */}
      <FilterGroup title="Industry" icon={<Building2 className="h-4 w-4" />}>
        {filterOptions.industries.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-3 cursor-pointer group/item py-1.5"
          >
            <Checkbox
              checked={filters.industries.includes(option.id)}
              onCheckedChange={() => onToggleFilter("industries", option.id)}
              className="rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="flex-1 text-sm group-hover/item:text-foreground transition-colors">
              {option.label}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {option.count}
            </span>
          </label>
        ))}
      </FilterGroup>

      {/* Clear All Button (Mobile) */}
      <Button
        variant="outline"
        onClick={onClearAll}
        className="w-full rounded-xl lg:hidden"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Clear All Filters
      </Button>
    </div>
  );
}

// ============ FILTER GROUP COMPONENT ============
function FilterGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full group"
      >
        <span className="flex items-center gap-2 font-medium text-sm">
          {icon}
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-1 pl-1"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
