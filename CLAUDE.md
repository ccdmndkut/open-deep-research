# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
- `pnpm dev` - Start Next.js development server
- `pnpm build` - Create production build
- `pnpm start` - Run production server
- `pnpm lint` - Run Next.js linting
- `pnpm db` - Push database schema changes with Drizzle Kit
- `pnpm workflow` - Run Upstash QStash CLI for local workflow development

## High-Level Architecture

### Tech Stack Overview
- **Frontend**: Next.js 14.2.3 with App Router, React 19.1.0, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI/LLM**: Together.ai for research, planning, and summarization
- **Workflows**: Upstash QStash/Workflow for long-running research tasks
- **Authentication**: Clerk for user management
- **Storage**: AWS S3 for images, Upstash Redis for state management

### Core Application Flow
1. User submits research question → stored in `research` table
2. Optional: System generates clarifying questions using LLM
3. Research workflow (`src/deepresearch/workflows/start-research-workflow.ts`):
   - Planning phase generates search queries
   - Iterative web searching and content summarization
   - Cover image generation using FLUX
   - Final report generation with sources
4. Real-time updates streamed to frontend via Redis pub/sub
5. Results displayed in chat-like interface

### Key Directories
- `src/app/api/` - API routes using Next.js App Router
- `src/deepresearch/` - Core research logic and workflows
- `src/db/` - Database schema and connection (Drizzle ORM)
- `src/components/` - React components with shadcn/ui
- `src/lib/` - Shared utilities and client configurations

### Database Schema
The main `research` table tracks:
- Research status (questions, pending, processing, completed)
- User inputs and generated content
- Sources and citations
- Cover images stored in S3

### API Endpoints
- `/api/research` - SSE endpoint for real-time research updates
- `/api/workflows/start-research` - Initiates research workflow
- `/api/storeAnswers` - Stores user answers to clarifying questions
- `/api/pdf` - Generates PDF from research reports
- `/api/validate-key` - Validates custom Together.ai API keys

### Environment Variables
Critical environment variables (see `.example.env`):
- `TOGETHER_API_KEY` - Together.ai for LLM operations
- `DATABASE_URL` - PostgreSQL connection
- `QSTASH_URL`, `QSTASH_TOKEN` - Workflow orchestration
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` - State management
- `AWS_S3_*` - Image storage credentials
- `CLERK_*` - Authentication keys

### Workflow Development
The research workflow uses Upstash QStash for serverless execution. Key workflow steps are defined in `src/deepresearch/workflows/start-research-workflow.ts`. Use `pnpm workflow` to test workflows locally with the QStash CLI.