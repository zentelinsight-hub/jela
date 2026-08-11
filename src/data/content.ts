import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Bot,
  BrainCircuit,
  Code2,
  FileSearch,
  GraduationCap,
  Image,
  MessageSquareText,
  Mic,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

export type FeatureItem = {
  title: string
  description: string
  icon: LucideIcon
  status: 'Planned for app launch' | 'Coming later'
}

export const features: FeatureItem[] = [
  {
    title: 'Conversational guidance',
    description: 'Ask follow-up questions and work through complex ideas in a natural, focused conversation.',
    icon: MessageSquareText,
    status: 'Planned for app launch',
  },
  {
    title: 'Learning support',
    description: 'Break down difficult subjects, revise concepts and build understanding at your own pace.',
    icon: GraduationCap,
    status: 'Planned for app launch',
  },
  {
    title: 'Research assistance',
    description: 'Organise a research question, identify useful directions and turn findings into a clear structure.',
    icon: Search,
    status: 'Planned for app launch',
  },
  {
    title: 'Programming help',
    description: 'Reason through code, understand errors and explore implementation approaches with context.',
    icon: Code2,
    status: 'Planned for app launch',
  },
  {
    title: 'Files and analysis',
    description: 'Bring supported documents into a conversation for summaries, explanations and structured analysis.',
    icon: FileSearch,
    status: 'Planned for app launch',
  },
  {
    title: 'Image understanding',
    description: 'Use visual context as part of a request where image analysis is supported by the selected AI model.',
    icon: Image,
    status: 'Coming later',
  },
  {
    title: 'Study tools',
    description: 'Turn a subject into revision prompts, practice questions and useful learning structures.',
    icon: BookOpen,
    status: 'Planned for app launch',
  },
  {
    title: 'Voice interaction',
    description: 'Speak naturally to Jela and hear responses in supported contexts and devices.',
    icon: Mic,
    status: 'Coming later',
  },
  {
    title: 'Connected research',
    description: 'Use current web sources when browsing support is available and appropriate for the request.',
    icon: BrainCircuit,
    status: 'Coming later',
  },
]

export const homeCapabilities = [
  {
    title: 'Learn with clarity',
    description: 'Move from a quick explanation to a deeper walkthrough without losing the thread.',
    icon: GraduationCap,
  },
  {
    title: 'Research with direction',
    description: 'Shape broad questions into useful lines of inquiry, outlines and next steps.',
    icon: Search,
  },
  {
    title: 'Create with momentum',
    description: 'Develop ideas, improve drafts and turn rough thinking into structured work.',
    icon: Sparkles,
  },
  {
    title: 'Solve with context',
    description: 'Work through technical and everyday problems with explanations that fit your goal.',
    icon: Bot,
  },
  {
    title: 'Analyse thoughtfully',
    description: 'Bring supported files into the conversation and focus on the details that matter.',
    icon: FileSearch,
  },
  {
    title: 'Stay in control',
    description: 'Clear security guidance and transparent product documentation keep expectations grounded.',
    icon: ShieldCheck,
  },
]

export const faqs = [
  {
    question: 'What is Jela AI?',
    answer:
      'Jela AI is an AI companion being built by Zentel Insight to support learning, research, creation and practical problem-solving through a native Android application.',
  },
  {
    question: 'Can I create an account on this website?',
    answer:
      'No. This public website provides product information, documentation and the official Android download. Account creation and authentication will happen inside the Jela AI application.',
  },
  {
    question: 'Where will I download Jela AI?',
    answer:
      'The official Android APK will be available only through the Jela AI download page when a verified release is published. The page will show version and integrity information before download.',
  },
  {
    question: 'Is the Android application available now?',
    answer:
      'The official download page reads the current verified APK from Jela AI’s production release service and shows its version and integrity details.',
  },
  {
    question: 'Why might Android ask me to allow installation?',
    answer:
      'Jela AI is distributed directly rather than through Google Play. Android may therefore ask you to allow installation from the browser or file manager you used. The download page provides clear installation guidance.',
  },
  {
    question: 'Will every answer be accurate?',
    answer:
      'AI can misunderstand context or produce incorrect information. Important academic, medical, legal, financial or safety-related decisions should always be checked against reliable sources and qualified professionals.',
  },
  {
    question: 'Will Jela AI support files and images?',
    answer:
      'Files and analysis are part of the intended product direction. Exact supported formats, limits and image capabilities will be documented when those features are released.',
  },
  {
    question: 'How can I contact the team?',
    answer:
      'Email zentelinsight@gmail.com or contact Zentel Insight by phone or WhatsApp on +234 706 083 3927.',
  },
]

export const docsNavigation = [
  { slug: 'getting-started', label: 'Getting Started', summary: 'Understand the website, Android app and official download flow.' },
  { slug: 'account-and-security', label: 'Account & Security', summary: 'Learn how application accounts and access are intended to work.' },
  { slug: 'using-jela', label: 'Using Jela AI', summary: 'Write useful prompts, refine answers and use Jela responsibly.' },
  { slug: 'files-and-analysis', label: 'Files & Analysis', summary: 'See how supported documents and visual context will be handled.' },
  { slug: 'plans-and-credits', label: 'Plans & usage', summary: 'Understand plan access, usage availability, and resets.' },
  { slug: 'privacy-and-data', label: 'Privacy & Data', summary: 'Review practical privacy principles and data choices.' },
]
