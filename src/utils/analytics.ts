/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Abbonamento, Fattura } from '../types.js';

export interface ActivityStats {
  registrationDate: string;
  membershipDays: number;
  activeDays: number;
  inactiveDays: number;
  inactivePercentage: number;
  currentStandstillDays: number;
  totalPaid: number;
  gaps: {
    from: string;
    to: string;
    days: number;
  }[];
}

/**
 * Calculates in-depth activity stats for an athlete.
 * Determines exactly how many days they were registered, active, and inactive, 
 * as well as identifying all specific gap blocks (where they had no active subscription coverage).
 */
export function calculateClientStatistics(
  allAbbonamenti: Abbonamento[],
  allFatture: Fattura[],
  clientCreatoIl: string
): ActivityStats {
  const todayStr = new Date().toISOString().substring(0, 10);
  const today = new Date(todayStr);

  // 1. Total Paid Amount
  const totalPaid = allFatture
    .filter(f => f.stato_pagamento === 'pagato')
    .reduce((sum, f) => sum + Number(f.importo), 0);

  // 2. Determine Registration Start Date
  let registrationDate = clientCreatoIl ? clientCreatoIl.substring(0, 10) : '2026-01-01';
  if (allAbbonamenti.length > 0) {
    const earliestAbb = [...allAbbonamenti].sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))[0];
    if (earliestAbb.data_inizio < registrationDate) {
      registrationDate = earliestAbb.data_inizio;
    }
  }

  const startDate = new Date(registrationDate);
  
  // Calculate total membership days from signup to today
  const membershipDiff = Math.max(0, today.getTime() - startDate.getTime());
  const membershipDays = Math.ceil(membershipDiff / (1000 * 60 * 60 * 24)) + 1;

  // 3. Subscription Coverage Map & Gap Identification
  // We check each day from start date until today.
  // This is highly robust and mathematically accurate.
  let activeDays = 0;
  const gaps: { from: string; to: string; days: number }[] = [];
  let gapStartStr: string | null = null;
  let gapCount = 0;

  const loopDate = new Date(startDate.getTime());
  while (loopDate <= today) {
    const currentDateStr = loopDate.toISOString().substring(0, 10);
    
    // Check if covered by any subscription on this day
    const isCovered = allAbbonamenti.some(a => 
      currentDateStr >= a.data_inizio && currentDateStr <= a.data_fine
    );

    if (isCovered) {
      activeDays++;
      // If we were tracking a gap, it has just ended
      if (gapStartStr) {
        gaps.push({
          from: gapStartStr,
          to: new Date(loopDate.getTime() - 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
          days: gapCount
        });
        gapStartStr = null;
        gapCount = 0;
      }
    } else {
      // If we are not covered, start or continue a gap
      if (!gapStartStr) {
        gapStartStr = currentDateStr;
      }
      gapCount++;
    }

    loopDate.setDate(loopDate.getDate() + 1);
  }

  // If we ended with a gap, close it on today
  if (gapStartStr) {
    gaps.push({
      from: gapStartStr,
      to: todayStr,
      days: gapCount
    });
  }

  const inactiveDays = membershipDays - activeDays;
  const inactivePercentage = membershipDays > 0 ? Math.round((inactiveDays / membershipDays) * 100) : 0;

  // 4. Current Standstill Days (Since latest subscription has expired to today, only if not currently active on today)
  const isCurrentlyActive = allAbbonamenti.some(a => 
    todayStr >= a.data_inizio && todayStr <= a.data_fine && a.stato === 'attivo'
  );

  let currentStandstillDays = 0;
  if (!isCurrentlyActive && allAbbonamenti.length > 0) {
    const sortedByEndDesc = [...allAbbonamenti].sort((a, b) => b.data_fine.localeCompare(a.data_fine));
    const latestEndDate = new Date(sortedByEndDesc[0].data_fine);
    if (latestEndDate < today) {
      const standstillDiff = today.getTime() - latestEndDate.getTime();
      currentStandstillDays = Math.max(0, Math.ceil(standstillDiff / (1000 * 60 * 60 * 24)));
    }
  } else if (allAbbonamenti.length === 0) {
    currentStandstillDays = membershipDays;
  }

  return {
    registrationDate,
    membershipDays,
    activeDays,
    inactiveDays: Math.max(0, inactiveDays),
    inactivePercentage,
    currentStandstillDays,
    totalPaid,
    gaps: gaps.sort((a, b) => b.from.localeCompare(a.from)) // sorted newest to oldest
  };
}
