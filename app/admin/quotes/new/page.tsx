import { createServerClient } from '@/lib/supabaseServer';
import { fetchAllProductData, fetchAllClients } from '@/lib/serverData';
import CreateQuoteManualClient from './CreateQuoteManualClient';

export default async function NewQuotePage() {
    const { products, comunas, eventTypes } = await fetchAllProductData();
    const clients = await fetchAllClients();
    
    return (
        <CreateQuoteManualClient 
            allProducts={products} 
            comunas={comunas} 
            eventTypes={eventTypes} 
            existingClients={clients}
        />
    );
}
