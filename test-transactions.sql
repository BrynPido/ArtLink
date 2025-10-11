-- Test data for listing_transaction table
-- This will create some sample transactions for testing the sales component

-- First, let's assume you have some test users and listings
-- You may need to adjust the IDs based on your actual data

-- Sample transaction 1: A completed sale
INSERT INTO listing_transaction (
    listingid, 
    buyerid, 
    sellerid, 
    conversationid, 
    finalprice, 
    status, 
    notes, 
    createdat
) VALUES (
    1, -- Replace with actual listing ID
    2, -- Replace with actual buyer user ID  
    1, -- Replace with actual seller user ID (your current user)
    1, -- Replace with actual conversation ID (can be NULL)
    150.00,
    'completed',
    'Great transaction, item as described',
    CURRENT_TIMESTAMP
);

-- Sample transaction 2: A pending sale
INSERT INTO listing_transaction (
    listingid, 
    buyerid, 
    sellerid, 
    conversationid, 
    finalprice, 
    status, 
    notes, 
    createdat
) VALUES (
    2, -- Replace with actual listing ID
    3, -- Replace with actual buyer user ID
    1, -- Replace with actual seller user ID (your current user)
    2, -- Replace with actual conversation ID (can be NULL)
    89.99,
    'pending',
    'Payment pending',
    CURRENT_TIMESTAMP
);

-- Sample transaction 3: A purchase (where current user is buyer)
INSERT INTO listing_transaction (
    listingid, 
    buyerid, 
    sellerid, 
    conversationid, 
    finalprice, 
    status, 
    notes, 
    createdat
) VALUES (
    3, -- Replace with actual listing ID
    1, -- Replace with your current user ID (as buyer)
    2, -- Replace with actual seller user ID
    3, -- Replace with actual conversation ID (can be NULL)
    75.50,
    'completed',
    'Great purchase!',
    CURRENT_TIMESTAMP
);

-- To check what users and listings exist, run these queries first:
-- SELECT id, name, username FROM "user" LIMIT 5;
-- SELECT id, title, authorId FROM listing LIMIT 5;

-- After inserting, you can verify the data with:
-- SELECT * FROM listing_transaction ORDER BY createdat DESC;