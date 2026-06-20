/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VpsPlan {
  id: string;
  name: string;
  cpu: string;
  ram: string;
  disk: string;
  bandwidth: string;
  ipAddresses: string;
  price: number; // monthly price in BRL (R$)
  popular?: boolean;
  link: string;
}

export interface LatencyServer {
  id: string;
  name: string;
  flag: string;
  location: string;
  ip: string;
  baseLatency: number; // in ms
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar?: string;
  rating: number;
  content: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}
