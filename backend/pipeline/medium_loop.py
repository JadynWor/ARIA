import cv2
import numpy as np
import time

def medium_loop(shared_state):
    # --- SETUP (runs once, before the loop) ---
    
    # Create ORB detector: cv2.ORB_create(nfeatures=500)
    # This finds distinctive points in an image (corners, edges)
    orb = cv2.ORB_create(nfeatures=500)
    
    # Create brute force matcher: cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    # This compares features between two frames
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    
    # Variables to remember the previous frame's features
    prev_keypoints = None
    prev_descriptors = None
    homography_matrix = None
    
    # --- LOOP ---
    while True:
        time.sleep(1)  # run every ~1 second
        
        # 1. Grab snapshot from shared state
        snapshot = shared_state.get_snapshot()
        frame = snapshot["latest_frame"]
        
        # 2. Skip if no frame yet
        if frame is None:
            continue
        
        # 3. Convert frame to grayscale
        # hint: cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
        
        # 4. Detect ORB features in this frame
        # hint: orb.detectAndCompute(gray, None) returns (keypoints, descriptors)
        dect = orb.detectAndCompute(gray, None)
        keypoints, descriptors = dect
        
        # 5. Skip if not enough features (smoke, dust, etc)
        if descriptors is None or len(keypoints) < 10:
            continue
        
        # 6. If we have previous frame's features, try to match
        if prev_descriptors is not None:
            # 6a. Match features: bf.knnMatch(prev_descriptors, descriptors, k=2)
            # k=2 means find the 2 best matches for each feature
            matches = bf.knnMatch(prev_descriptors, descriptors, k=2)
            
            # 6b. Lowe's ratio test — filter bad matches
            # A good match: the best match is much better than the second best
            # Loop through matches, keep only where m.distance < 0.75 * n.distance
            good_matches = []
            
            for m, n in matches:
                if m.distance < 0.75 * n.distance:
                    good_matches.append(m)
            if len(good_matches) >= 10:
                # Extract coordinates of matched points source and destination
                src_pts = np.float32([prev_keypoints[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([keypoints[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                
                # Compute homography — matrix is the 3x3 transform, mask shows which matches RANSAC kept
                matrix, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
                
                # Count how many matches RANSAC agreed with
                inliers = mask.sum() if mask is not None else 0
                
                # Only update if the result is reliable
                if matrix is not None and inliers >= 10:
                    shared_state.update_homography(matrix)
        prev_keypoints = keypoints
        prev_descriptors = descriptors