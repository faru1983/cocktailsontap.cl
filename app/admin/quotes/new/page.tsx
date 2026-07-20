import { fetchAllProductData, fetchAllClients } from '@/lib/serverData';
import CreateQuoteManualClient from './CreateQuoteManualClient';

type SearchParams = Promise<{ type?: string }>;

export default async function NewQuotePage({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;
    const initialServiceType = params.type === 'direct' ? 'direct' : 'event';

    const { products, comunas, eventTypes } = await fetchAllProductData();
    const clients = await fetchAllClients();
    
    return (
        <CreateQuoteManualClient 
            allProducts={products} 
            comunas={comunas} 
            eventTypes={eventTypes} 
            existingClients={clients}
            initialServiceType={initialServiceType}
        />
    );
}
