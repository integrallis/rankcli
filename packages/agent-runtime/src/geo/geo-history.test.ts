import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GEOHistory,
  GEOTrend,
  GEOAlert,
  GEOAlertType,
  createGEOHistory,
  addTrackingResult,
  getVisibilityTrend,
  detectVisibilityChanges,
  generateGEOReport,
  compareCompetitorVisibility,
  CompetitorComparison,
} from './geo-history.js';
import { GEOResult } from './geo-tracker.js';

describe('geo-history', () => {
  const mockResult: GEOResult = {
    provider: 'openai',
    keyword: 'best seo cli tool',
    mentioned: true,
    position: 2,
    sentiment: 'positive',
    score: 75,
    timestamp: '2024-01-15T10:00:00Z',
  };

  describe('createGEOHistory', () => {
    it('creates empty history', () => {
      const history = createGEOHistory();

      expect(history.results).toEqual([]);
      expect(history.brandName).toBeUndefined();
    });

    it('creates history with brand name', () => {
      const history = createGEOHistory({ brandName: 'SEO Autopilot' });

      expect(history.brandName).toBe('SEO Autopilot');
    });
  });

  describe('addTrackingResult', () => {
    it('adds result to history', () => {
      const history = createGEOHistory();
      const updated = addTrackingResult(history, mockResult);

      expect(updated.results).toHaveLength(1);
      expect(updated.results[0]).toEqual(mockResult);
    });

    it('maintains chronological order', () => {
      const history = createGEOHistory();
      const older = { ...mockResult, timestamp: '2024-01-14T10:00:00Z' };
      const newer = { ...mockResult, timestamp: '2024-01-16T10:00:00Z' };

      let updated = addTrackingResult(history, newer);
      updated = addTrackingResult(updated, older);

      expect(updated.results[0].timestamp).toBe('2024-01-14T10:00:00Z');
      expect(updated.results[1].timestamp).toBe('2024-01-16T10:00:00Z');
    });

    it('limits history size when maxResults specified', () => {
      const history = createGEOHistory({ maxResults: 3 });
      let updated = history;

      for (let i = 0; i < 5; i++) {
        updated = addTrackingResult(updated, {
          ...mockResult,
          timestamp: `2024-01-${10 + i}T10:00:00Z`,
        });
      }

      expect(updated.results).toHaveLength(3);
      // Should keep most recent
      expect(updated.results[2].timestamp).toBe('2024-01-14T10:00:00Z');
    });
  });

  describe('getVisibilityTrend', () => {
    it('calculates trend from history', () => {
      const history = createGEOHistory();
      const results: GEOResult[] = [
        { ...mockResult, timestamp: '2024-01-10T10:00:00Z', score: 50, mentioned: true },
        { ...mockResult, timestamp: '2024-01-11T10:00:00Z', score: 60, mentioned: true },
        { ...mockResult, timestamp: '2024-01-12T10:00:00Z', score: 70, mentioned: true },
        { ...mockResult, timestamp: '2024-01-13T10:00:00Z', score: 80, mentioned: true },
      ];

      let updated = history;
      for (const r of results) {
        updated = addTrackingResult(updated, r);
      }

      const trend = getVisibilityTrend(updated, 'openai', 'best seo cli tool');

      expect(trend.direction).toBe('improving');
      expect(trend.averageScore).toBe(65); // (50+60+70+80)/4
      expect(trend.mentionRate).toBe(100); // 4/4 * 100
    });

    it('detects declining trend', () => {
      const history = createGEOHistory();
      const results: GEOResult[] = [
        { ...mockResult, timestamp: '2024-01-10T10:00:00Z', score: 80 },
        { ...mockResult, timestamp: '2024-01-11T10:00:00Z', score: 70 },
        { ...mockResult, timestamp: '2024-01-12T10:00:00Z', score: 50 },
        { ...mockResult, timestamp: '2024-01-13T10:00:00Z', score: 30 },
      ];

      let updated = history;
      for (const r of results) {
        updated = addTrackingResult(updated, r);
      }

      const trend = getVisibilityTrend(updated, 'openai', 'best seo cli tool');

      expect(trend.direction).toBe('declining');
    });

    it('detects stable trend', () => {
      const history = createGEOHistory();
      const results: GEOResult[] = [
        { ...mockResult, timestamp: '2024-01-10T10:00:00Z', score: 70 },
        { ...mockResult, timestamp: '2024-01-11T10:00:00Z', score: 72 },
        { ...mockResult, timestamp: '2024-01-12T10:00:00Z', score: 68 },
        { ...mockResult, timestamp: '2024-01-13T10:00:00Z', score: 71 },
      ];

      let updated = history;
      for (const r of results) {
        updated = addTrackingResult(updated, r);
      }

      const trend = getVisibilityTrend(updated, 'openai', 'best seo cli tool');

      expect(trend.direction).toBe('stable');
    });

    it('returns empty trend for no data', () => {
      const history = createGEOHistory();
      const trend = getVisibilityTrend(history, 'openai', 'unknown keyword');

      expect(trend.direction).toBe('unknown');
      expect(trend.dataPoints).toBe(0);
    });
  });

  describe('detectVisibilityChanges', () => {
    it('detects new mention', () => {
      const history = createGEOHistory();
      const oldResults: GEOResult[] = [
        { ...mockResult, mentioned: false, timestamp: '2024-01-10T10:00:00Z' },
        { ...mockResult, mentioned: false, timestamp: '2024-01-11T10:00:00Z' },
      ];
      const newResult = { ...mockResult, mentioned: true, timestamp: '2024-01-12T10:00:00Z' };

      let updated = history;
      for (const r of oldResults) {
        updated = addTrackingResult(updated, r);
      }

      const alerts = detectVisibilityChanges(updated, newResult);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('new_mention');
    });

    it('detects lost mention', () => {
      const history = createGEOHistory();
      const oldResults: GEOResult[] = [
        { ...mockResult, mentioned: true, timestamp: '2024-01-10T10:00:00Z' },
        { ...mockResult, mentioned: true, timestamp: '2024-01-11T10:00:00Z' },
      ];
      const newResult = { ...mockResult, mentioned: false, timestamp: '2024-01-12T10:00:00Z' };

      let updated = history;
      for (const r of oldResults) {
        updated = addTrackingResult(updated, r);
      }

      const alerts = detectVisibilityChanges(updated, newResult);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('lost_mention');
    });

    it('detects position improvement', () => {
      const history = createGEOHistory();
      const oldResults: GEOResult[] = [
        { ...mockResult, position: 5, timestamp: '2024-01-10T10:00:00Z' },
        { ...mockResult, position: 5, timestamp: '2024-01-11T10:00:00Z' },
      ];
      const newResult = { ...mockResult, position: 1, timestamp: '2024-01-12T10:00:00Z' };

      let updated = history;
      for (const r of oldResults) {
        updated = addTrackingResult(updated, r);
      }

      const alerts = detectVisibilityChanges(updated, newResult);

      expect(alerts.some(a => a.type === 'position_improved')).toBe(true);
    });

    it('detects position drop', () => {
      const history = createGEOHistory();
      const oldResults: GEOResult[] = [
        { ...mockResult, position: 1, timestamp: '2024-01-10T10:00:00Z' },
        { ...mockResult, position: 1, timestamp: '2024-01-11T10:00:00Z' },
      ];
      const newResult = { ...mockResult, position: 5, timestamp: '2024-01-12T10:00:00Z' };

      let updated = history;
      for (const r of oldResults) {
        updated = addTrackingResult(updated, r);
      }

      const alerts = detectVisibilityChanges(updated, newResult);

      expect(alerts.some(a => a.type === 'position_dropped')).toBe(true);
    });

    it('detects sentiment change', () => {
      const history = createGEOHistory();
      const oldResults: GEOResult[] = [
        { ...mockResult, sentiment: 'positive', timestamp: '2024-01-10T10:00:00Z' },
        { ...mockResult, sentiment: 'positive', timestamp: '2024-01-11T10:00:00Z' },
      ];
      const newResult = { ...mockResult, sentiment: 'negative', timestamp: '2024-01-12T10:00:00Z' };

      let updated = history;
      for (const r of oldResults) {
        updated = addTrackingResult(updated, r);
      }

      const alerts = detectVisibilityChanges(updated, newResult);

      expect(alerts.some(a => a.type === 'sentiment_changed')).toBe(true);
    });

    it('returns empty alerts for no significant change', () => {
      const history = createGEOHistory();
      const oldResults: GEOResult[] = [
        { ...mockResult, timestamp: '2024-01-10T10:00:00Z' },
        { ...mockResult, timestamp: '2024-01-11T10:00:00Z' },
      ];
      const newResult = { ...mockResult, timestamp: '2024-01-12T10:00:00Z' };

      let updated = history;
      for (const r of oldResults) {
        updated = addTrackingResult(updated, r);
      }

      const alerts = detectVisibilityChanges(updated, newResult);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('generateGEOReport', () => {
    it('generates summary report', () => {
      const history = createGEOHistory({ brandName: 'SEO Autopilot' });
      const results: GEOResult[] = [
        { ...mockResult, provider: 'openai', mentioned: true, score: 80 },
        { ...mockResult, provider: 'anthropic', mentioned: true, score: 70 },
        { ...mockResult, provider: 'google', mentioned: false, score: 0 },
      ];

      let updated = history;
      for (const r of results) {
        updated = addTrackingResult(updated, r);
      }

      const report = generateGEOReport(updated);

      expect(report.brandName).toBe('SEO Autopilot');
      expect(report.totalQueries).toBe(3);
      expect(report.mentionRate).toBeCloseTo(66.67, 1);
      expect(report.averageScore).toBe(50); // (80+70+0)/3
      expect(report.byProvider).toHaveProperty('openai');
      expect(report.byProvider).toHaveProperty('anthropic');
    });

    it('includes provider breakdown', () => {
      const history = createGEOHistory();
      const results: GEOResult[] = [
        { ...mockResult, provider: 'openai', keyword: 'kw1', score: 80 },
        { ...mockResult, provider: 'openai', keyword: 'kw2', score: 60 },
        { ...mockResult, provider: 'anthropic', keyword: 'kw1', score: 90 },
      ];

      let updated = history;
      for (const r of results) {
        updated = addTrackingResult(updated, r);
      }

      const report = generateGEOReport(updated);

      expect(report.byProvider.openai.queries).toBe(2);
      expect(report.byProvider.openai.averageScore).toBe(70);
      expect(report.byProvider.anthropic.queries).toBe(1);
    });

    it('includes keyword breakdown', () => {
      const history = createGEOHistory();
      const results: GEOResult[] = [
        { ...mockResult, keyword: 'seo tool', score: 80 },
        { ...mockResult, keyword: 'seo tool', score: 70 },
        { ...mockResult, keyword: 'cli seo', score: 60 },
      ];

      let updated = history;
      for (const r of results) {
        updated = addTrackingResult(updated, r);
      }

      const report = generateGEOReport(updated);

      expect(report.byKeyword['seo tool'].queries).toBe(2);
      expect(report.byKeyword['seo tool'].averageScore).toBe(75);
    });
  });

  describe('compareCompetitorVisibility', () => {
    it('compares brand against competitors', () => {
      const brandHistory = createGEOHistory({ brandName: 'SEO Autopilot' });
      let brandUpdated = brandHistory;
      brandUpdated = addTrackingResult(brandUpdated, {
        ...mockResult,
        keyword: 'best seo tool',
        mentioned: true,
        position: 2,
        score: 75,
      });

      const competitorResults: GEOResult[] = [
        { ...mockResult, keyword: 'best seo tool', mentioned: true, position: 1, score: 90 },
      ];

      const comparison = compareCompetitorVisibility(
        brandUpdated,
        'Ahrefs',
        competitorResults
      );

      expect(comparison.brand).toBe('SEO Autopilot');
      expect(comparison.competitor).toBe('Ahrefs');
      expect(comparison.brandMentionRate).toBe(100);
      expect(comparison.competitorMentionRate).toBe(100);
      expect(comparison.brandAveragePosition).toBe(2);
      expect(comparison.competitorAveragePosition).toBe(1);
    });

    it('handles unmentioned competitor', () => {
      const brandHistory = createGEOHistory({ brandName: 'SEO Autopilot' });
      let brandUpdated = brandHistory;
      brandUpdated = addTrackingResult(brandUpdated, {
        ...mockResult,
        mentioned: true,
        position: 1,
      });

      const competitorResults: GEOResult[] = [
        { ...mockResult, mentioned: false, position: null, score: 0 },
      ];

      const comparison = compareCompetitorVisibility(
        brandUpdated,
        'Unknown Tool',
        competitorResults
      );

      expect(comparison.competitorMentionRate).toBe(0);
      expect(comparison.winner).toBe('SEO Autopilot');
    });

    it('determines winner by mention rate and position', () => {
      const brandHistory = createGEOHistory({ brandName: 'SEO Autopilot' });
      let brandUpdated = brandHistory;
      brandUpdated = addTrackingResult(brandUpdated, {
        ...mockResult,
        mentioned: true,
        position: 3,
        score: 60,
      });

      const competitorResults: GEOResult[] = [
        { ...mockResult, mentioned: true, position: 1, score: 90 },
      ];

      const comparison = compareCompetitorVisibility(
        brandUpdated,
        'Ahrefs',
        competitorResults
      );

      expect(comparison.winner).toBe('Ahrefs');
    });
  });

  describe('integration scenarios', () => {
    it('tracks visibility over time and generates alerts', () => {
      const history = createGEOHistory({ brandName: 'SEO Autopilot' });

      // Day 1: Not mentioned
      let updated = addTrackingResult(history, {
        ...mockResult,
        mentioned: false,
        timestamp: '2024-01-10T10:00:00Z',
      });

      // Day 2: Still not mentioned
      updated = addTrackingResult(updated, {
        ...mockResult,
        mentioned: false,
        timestamp: '2024-01-11T10:00:00Z',
      });

      // Day 3: Now mentioned!
      const newResult: GEOResult = {
        ...mockResult,
        mentioned: true,
        position: 3,
        timestamp: '2024-01-12T10:00:00Z',
      };

      const alerts = detectVisibilityChanges(updated, newResult);

      expect(alerts.some(a => a.type === 'new_mention')).toBe(true);

      // Add to history
      updated = addTrackingResult(updated, newResult);

      // Check trend
      const trend = getVisibilityTrend(updated, 'openai', 'best seo cli tool');
      expect(trend.mentionRate).toBeCloseTo(33.33, 1); // 1/3
    });

    it('full workflow with report generation', () => {
      const history = createGEOHistory({ brandName: 'SEO Autopilot' });

      // Simulate a week of tracking across providers
      const providers = ['openai', 'anthropic', 'google'] as const;
      const keywords = ['seo cli tool', 'developer seo'];

      let updated = history;
      let day = 10;

      for (const provider of providers) {
        for (const keyword of keywords) {
          updated = addTrackingResult(updated, {
            provider,
            keyword,
            mentioned: Math.random() > 0.3,
            position: Math.floor(Math.random() * 5) + 1,
            sentiment: 'positive',
            score: Math.floor(Math.random() * 50) + 50,
            timestamp: `2024-01-${day}T10:00:00Z`,
          });
          day++;
        }
      }

      const report = generateGEOReport(updated);

      expect(report.totalQueries).toBe(6);
      expect(Object.keys(report.byProvider)).toHaveLength(3);
      expect(Object.keys(report.byKeyword)).toHaveLength(2);
    });
  });
});
