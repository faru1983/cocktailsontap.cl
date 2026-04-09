import { createServerClient } from '@/lib/supabaseServer';
import { fetchAllProductData } from '@/lib/serverData';
import CreateQuoteManualClient from './CreateQuoteManualClient';

export default async function NewQuotePage() {
    const { products, comunas, eventTypes } = await fetchAllProductData();
    
    return (
        <CreateQuoteManualClient 
            allProducts={products} 
            comunas={comunas} 
            eventTypes={eventTypes} 
        />
    );
}
