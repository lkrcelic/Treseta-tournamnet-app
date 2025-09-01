"use client";

import React from 'react';
import {Box, Skeleton, Typography} from '@mui/material';
import {Grid} from "@mui/system";
import SingleActionButton from "@/app/_ui/SingleActionButton";
import Home from '@mui/icons-material/Home';

interface LoadingScoreBoardProps {
  isMobile: boolean;
}

const LoadingScoreBoard: React.FC<LoadingScoreBoardProps> = ({isMobile}) => {
  return (
    <>
      <Box sx={{gridArea: "top", alignSelf: "end"}}>
        <Grid container justifyContent="space-between" alignItems="top" spacing={6}>
          <Grid item size={{xs: 6}}>
            <Grid container direction="column" alignItems="center" spacing={2} paddingTop={1}>
              <Box
                sx={{
                  backgroundColor: 'team1.main',
                  width: 55,
                  height: 55,
                  borderRadius: '50%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                <Skeleton variant="text" width={20} height={40} sx={{bgcolor: 'rgba(255, 255, 255, 0.3)'}}/>
              </Box>
              <Skeleton variant="text" width={80} height={24}/>
            </Grid>
          </Grid>
          <Grid item size={{xs: 6}}>
            <Grid container direction="column" alignItems="center" spacing={2} paddingTop={1}>
              <Box sx={{
                backgroundColor: 'team2.main',
                width: 55,
                height: 55,
                borderRadius: '50%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Skeleton variant="text" width={20} height={40} sx={{bgcolor: 'rgba(255, 255, 255, 0.3)'}}/>
              </Box>
              <Skeleton variant="text" width={80} height={24}/>
            </Grid>
          </Grid>
        </Grid>
      </Box>
      <Box sx={{gridArea: "body", overflowY: 'auto', paddingTop: 4}}>
        <Grid container spacing={5} justifyContent="center" alignItems="bottom">
          {[...Array(3)].map((_, index) => (
            <Box key={index} sx={{width: '88%', borderRadius: '20px', marginBottom: 2}}>
              <Grid container justifyContent="space-evenly" alignItems="center"
                    sx={{backgroundColor: "secondary.main", borderRadius: "20px", paddingY: 0.5}}>
                <Grid item size={{xs: 4}}>
                  <Skeleton variant="text" width={30} height={40}
                            sx={{bgcolor: 'rgba(0, 0, 0, 0.1)', margin: '0 auto'}}/>
                </Grid>

                <Grid item size={{xs: 2}}>
                  <Typography variant="body1" textAlign="center">
                    •
                  </Typography>
                </Grid>

                <Grid item size={{xs: 4}}>
                  <Skeleton variant="text" width={30} height={40}
                            sx={{bgcolor: 'rgba(0, 0, 0, 0.1)', margin: '0 auto'}}/>
                </Grid>
              </Grid>
            </Box>
          ))}
        </Grid>
      </Box>
      <Box sx={{gridArea: "actions", alignSelf: "start"}}>
        <SingleActionButton
          label={"Početni zaslon"}
          icon={<Home/>}
          fullWidth={isMobile}
          onClick={() => {
          }}
        />
      </Box>
    </>
  );
};

export default LoadingScoreBoard;
