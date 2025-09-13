idf_component_register(
  SRCS "swd_driver.c" "swd_programmer.cpp"
  INCLUDE_DIRS "."
  REQUIRES driver esp_timer
)
