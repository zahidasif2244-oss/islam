import { NextResponse } from 'next/server'
import booksData from '@/data/books.json'

export interface BookItem {
  title: string
  author: string
  pages: string
  cover: string
  thumbnail: string
  url: string
  pdf: string
  audioUrl: string
  audioPlay: string
  audioDownload: string
  source: string
}

export async function GET() {
  return NextResponse.json(booksData, { headers: { 'content-type': 'application/json' } })
}