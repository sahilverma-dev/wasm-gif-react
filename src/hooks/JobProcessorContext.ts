import { createContext, useContext } from "react";

interface JobProcessorContextType {
  handleCancelJob: (jobId: string) => void;
}

export const JobProcessorContext = createContext<JobProcessorContextType>({
  handleCancelJob: () => {},
});

export function useJobProcessorContext() {
  return useContext(JobProcessorContext);
}
