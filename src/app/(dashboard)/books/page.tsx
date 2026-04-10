import { Metadata } from 'next';
import BooksView from '@/components/books/BooksView';

export const metadata: Metadata = {
    title: 'Book List',
    description: 'Find your semester book lists and subjects here.',
};

export default function BooksPage() {
    return <BooksView />;
}
