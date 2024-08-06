import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { Rect, Text } from 'react-native-svg';
import * as d3 from 'd3';


const data = [
    { label: 'Jan', value: 500 },
    { label: 'Feb', value: 312 },
    { label: 'Mar', value: 424 },
    { label: 'Apr', value: 745 },
    // Add more months data...
  ];
const BarChart = () => {
  const svgWidth = Dimensions.get('window').width;
  const svgHeight = 300;
  const padding = 20;

  // Scale for the bars
  const xScale = d3.scaleBand()
    .range([0, svgWidth - padding])
    .padding(0.1)
    .domain(data.map(d => d.label));

  const yScale = d3.scaleLinear()
    .range([svgHeight - padding, 0])
    .domain([0, d3.max(data, d => d.value)]);

  return (
    <Svg width={svgWidth} height={svgHeight}>
      {data.map((item, index) => (
        <Rect
          key={index}
          x={xScale(item.label)}
          y={yScale(item.value)}
          width={xScale.bandwidth()}
          height={svgHeight - padding - yScale(item.value)}
          fill="tomato"
        />
      ))}
      {data.map((item, index) => (
        <Text
          key={index}
          x={xScale(item.label) + xScale.bandwidth() / 2}
          y={yScale(item.value) - 6}
          fontSize={14}
          fill="black"
          textAnchor="middle"
        >
          {item.value}
        </Text>
      ))}
    </Svg>
  );
};

export default BarChart;
