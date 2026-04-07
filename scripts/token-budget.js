#!/usr/bin/env node

/**
 * Token budget analyzer for Claude Code
 * Helps track token usage across project files
 */

import { countTokens } from '@anthropic-ai/tokenizer';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { minimatch } from 'minimatch';

// Read .claudeignore patterns
function readIgnorePatterns() {
  try {
    const ignoreFile = readFileSync('.claudeignore', 'utf-8');
    return ignoreFile
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => line.trim());
  } catch {
    return ['node_modules/**', 'dist/**', 'build/**', '*.lock'];
  }
}

// Check if file should be ignored
function shouldIgnore(path, patterns) {
  return patterns.some(pattern => minimatch(path, pattern));
}

// Recursively get all files
function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const ignorePatterns = readIgnorePatterns();

  function walk(currentDir) {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const relativePath = relative(baseDir, fullPath);

      if (shouldIgnore(relativePath, ignorePatterns)) continue;

      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        files.push({ path: fullPath, relativePath, size: stat.size });
      }
    }
  }

  walk(dir);
  return files;
}

// Analyze token usage
async function analyzeTokens(files) {
  const results = [];
  let totalTokens = 0;

  for (const file of files) {
    try {
      // Skip binary files
      if (/\.(png|jpg|jpeg|gif|ico|pdf|zip|tar|gz)$/i.test(file.path)) {
        continue;
      }

      const content = readFileSync(file.path, 'utf-8');
      const tokens = await countTokens(content);

      results.push({
        path: file.relativePath,
        tokens,
        size: file.size,
        ratio: tokens / file.size
      });

      totalTokens += tokens;
    } catch (err) {
      // Skip files that can't be read as text
    }
  }

  return { results, totalTokens };
}

// Main
async function main() {
  console.log('🔍 Analyzing token budget...\n');

  const targetDir = process.argv[2] || '.';
  const files = getAllFiles(targetDir);

  console.log(`Found ${files.length} files to analyze...`);

  const { results, totalTokens } = await analyzeTokens(files);

  // Sort by token count
  results.sort((a, b) => b.tokens - a.tokens);

  // Show top 20 heaviest files
  console.log('\n📊 Top 20 files by token count:');
  console.log('─'.repeat(80));

  for (const file of results.slice(0, 20)) {
    const bar = '█'.repeat(Math.floor(file.tokens / 1000));
    console.log(
      `${file.tokens.toString().padStart(7)} tokens │ ${bar} ${file.path}`
    );
  }

  console.log('─'.repeat(80));
  console.log(`\n📈 Total tokens: ${totalTokens.toLocaleString()}`);

  // Context window analysis
  const CONTEXT_LIMITS = {
    'Claude 3 Opus': 200000,
    'Claude 3.5 Sonnet': 200000,
    'Claude 3 Haiku': 200000
  };

  console.log('\n💡 Context window usage:');
  for (const [model, limit] of Object.entries(CONTEXT_LIMITS)) {
    const percentage = ((totalTokens / limit) * 100).toFixed(1);
    console.log(`  ${model}: ${percentage}% of ${limit.toLocaleString()} tokens`);
  }

  // Recommendations
  if (totalTokens > 100000) {
    console.log('\n⚠️  Recommendations:');
    console.log('  - Consider adding more patterns to .claudeignore');
    console.log('  - Split large files into smaller modules');
    console.log('  - Use references (@file) in CLAUDE.md instead of inline content');
  }
}

main().catch(console.error);