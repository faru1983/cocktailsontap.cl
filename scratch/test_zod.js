const { z } = require('zod');

const schema = z.object({
    size_value: z.number().optional()
});

console.log('Testing null:', schema.safeParse({ size_value: null }).success);
console.log('Testing undefined:', schema.safeParse({ size_value: undefined }).success);
console.log('Testing number:', schema.safeParse({ size_value: 10 }).success);
console.log('Testing string:', schema.safeParse({ size_value: '10' }).success);

const schemaNullable = z.object({
    size_value: z.number().nullable().optional()
});
console.log('Testing null (nullable):', schemaNullable.safeParse({ size_value: null }).success);

const schemaCoerce = z.object({
    size_value: z.coerce.number().nullable().optional()
});
console.log('Testing string (coerce):', schemaCoerce.safeParse({ size_value: '10' }).success);
